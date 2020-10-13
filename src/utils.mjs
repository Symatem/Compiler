import { LLVMStructureType, LLVMPointerType, LLVMIntegerType } from './LLVM/Type.mjs';
import { LLVMValue, LLVMLiteralConstant, LLVMFunction } from './LLVM/Value.mjs';
import { LLVMExtractValueInstruction, LLVMInsertValueInstruction, LLVMCallInstruction, LLVMReturnInstruction, LLVMCastInstruction } from './LLVM/Instruction.mjs';
import { LLVMSymbolType, LLVMVoidConstant, bundleOperands, unbundleOperands, operandsToLlvmValues } from './values.mjs';
import { log, throwError, throwWarning, pushStackFrame, popStackFrame } from './stackTrace.mjs';
import { Utils, SymbolInternals } from '../node_modules/@symatem/core/SymatemJS.mjs';



export function hashOfOperands(context, operands) {
    let i = 0, dataLength = operands.size*32*5;
    for(const [operandTag, operand] of operands)
        dataLength += Math.ceil(context.backend.getLength(operand)/8)*8;
    const dataBytes = new Uint8Array(Math.ceil(dataLength/8)),
          view = new DataView(dataBytes.buffer);
    for(const [operandTag, operand] of operands) {
        const operandDataBytes = context.backend.getRawData(operand);
        view.setUint32(i, SymbolInternals.namespaceOfSymbol(operandTag), true);
        view.setUint32(i+4, SymbolInternals.identityOfSymbol(operandTag), true);
        view.setUint32(i+8, SymbolInternals.namespaceOfSymbol(operand), true);
        view.setUint32(i+12, SymbolInternals.identityOfSymbol(operand), true);
        view.setUint32(i+16, operandDataBytes.byteLength, true);
        i += 20;
        dataBytes.set(operandDataBytes, i);
        i += operandDataBytes.byteLength;
    }
    return Utils.encodeBigInt(Utils.blake2s(8, dataBytes));
}

export function copyAndRenameOperand(destinationOperands, destinationLlvmValues, entry, dstOperandTag, srcOperandTag) {
    destinationOperands.set(dstOperandTag, entry.inputOperands.get(srcOperandTag));
    const llvmValue = entry.aux.inputLlvmValues.get(srcOperandTag);
    if(llvmValue)
        destinationLlvmValues.set(dstOperandTag, llvmValue);
}

export function collectDestinations(context, entry, destinationOperat) {
    let carriers = new Map(),
        referenceCount = 0;
    for(const triple of context.backend.queryTriples(context.backend.queryMasks.VMM, [context.backend.symbolByName.Void, context.backend.symbolByName.DestinationOperat, destinationOperat])) {
        const destinationOperandTag = context.backend.getPairOptionally(triple[0], context.backend.symbolByName.DestinationOperandTag);
        if(carriers.has(destinationOperandTag))
            throwError(context, destinationOperandTag, 'DestinationOperandTag collision detected');
        carriers.set(destinationOperandTag, triple[0]);
    }
    carriers = Utils.sorted(carriers);
    const destinationOperands = (destinationOperat === entry.operator) ? entry.outputOperands : new Map(),
          destinationLlvmValues = new Map();
    for(const [destinationOperandTag, carrier] of carriers) {
        let destinationOperand;
        const sourceOperandTag = context.backend.getPairOptionally(carrier, context.backend.symbolByName.SourceOperandTag);
        if(sourceOperandTag === context.backend.symbolByName.Constant) {
            const sourceOperand = context.backend.getPairOptionally(carrier, context.backend.symbolByName.SourceOperat);
            if(context.backend.getTriple([sourceOperand, context.backend.symbolByName.Type, context.backend.symbolByName.TypedPlaceholder]))
                throwError(context, carrier, 'Const carrier uses a TypedPlaceholder as source operand');
            destinationOperand = sourceOperand;
        } else {
            ++referenceCount;
            destinationLlvmValues.set(destinationOperandTag, undefined);
        }
        destinationOperands.set(destinationOperandTag, destinationOperand);
    }
    entry.aux.operatDestinationOperands.set(destinationOperat, destinationOperands);
    entry.aux.operatDestinationLlvmValues.set(destinationOperat, destinationLlvmValues);
    if(destinationOperat === entry.operator)
        entry.aux.outputLlvmValues = destinationLlvmValues;
    else if(referenceCount === 0)
        entry.aux.readyOperations.push(destinationOperat);
    else
        entry.aux.unsatisfiedOperations.set(destinationOperat, referenceCount);
}

export function propagateSources(context, entry, sourceOperat, sourceOperands, sourceLlvmValues, sourceOperandBundle, sourceLlvmValueBundle) {
    const unusedOperandTags = new Set(sourceOperands.keys());
    for(const triple of context.backend.queryTriples(context.backend.queryMasks.VMM, [context.backend.symbolByName.Void, context.backend.symbolByName.SourceOperat, sourceOperat])) {
        const carrier = triple[0],
              sourceOperandTag = context.backend.getPairOptionally(carrier, context.backend.symbolByName.SourceOperandTag);
        if(sourceOperandTag === context.backend.symbolByName.Constant)
            continue;
        unusedOperandTags.delete(sourceOperandTag);
        let sourceOperand = sourceOperands.get(sourceOperandTag),
            sourceLlvmValue = sourceLlvmValues.get(sourceOperandTag);
        if(sourceOperandTag === context.backend.symbolByName.OperandBundle) {
            unusedOperandTags.clear();
            sourceOperand = sourceOperandBundle;
            sourceLlvmValue = sourceLlvmValueBundle;
        }
        const destinationOperandTag = context.backend.getPairOptionally(carrier, context.backend.symbolByName.DestinationOperandTag),
              destinationOperat = context.backend.getPairOptionally(carrier, context.backend.symbolByName.DestinationOperat),
              destinationLlvmValues = entry.aux.operatDestinationLlvmValues.get(destinationOperat);
        if(sourceOperand && sourceLlvmValue)
            destinationLlvmValues.set(destinationOperandTag, sourceLlvmValue);
        else
            destinationLlvmValues.delete(destinationOperandTag);
        if(!sourceOperand) {
            sourceOperand = context.backend.symbolByName.Void;
            throwWarning(context, sourceOperandTag, 'Operand not found. Using Void as fallback');
        }
        entry.aux.operatDestinationOperands.get(destinationOperat).set(destinationOperandTag, sourceOperand);
        if(sourceLlvmValue)
            destinationLlvmValues.set(destinationOperandTag, sourceLlvmValue);
        else
            destinationLlvmValues.delete(destinationOperandTag);
        if(destinationOperat !== entry.operator) {
            const referenceCount = entry.aux.unsatisfiedOperations.get(destinationOperat)-1;
            if(referenceCount === 0) {
                entry.aux.unsatisfiedOperations.delete(destinationOperat);
                entry.aux.readyOperations.push(destinationOperat);
            } else
                entry.aux.unsatisfiedOperations.set(destinationOperat, referenceCount);
        }
    }
    if(unusedOperandTags.size > 0)
        throwWarning(context, unusedOperandTags, 'Unused operand(s)');
}

export function customOperator(context, entry) {
    entry.aux.operatDestinationLlvmValues = new Map();
    entry.aux.operatDestinationOperands = new Map();
    entry.aux.operationsBlockedByThis = new Map();
    entry.aux.unsatisfiedOperations = new Map();
    entry.aux.readyOperations = [];
    entry.aux.blockedOperations = new Set();
    entry.aux.resume = function() {
        while(entry.aux.readyOperations.length > 0) {
            const operation = entry.aux.readyOperations.shift(),
                  [instanceEntry, sourceLlvmValues, sourceLlvmValueBundle] = buildLlvmCall(
                context,
                entry.aux.llvmBasicBlock,
                entry,
                operation,
                entry.aux.operatDestinationOperands.get(operation),
                entry.aux.operatDestinationLlvmValues.get(operation)
            );
            if(sourceLlvmValues)
                propagateSources(context, entry, operation, instanceEntry.outputOperands, sourceLlvmValues, entry.outputOperandBundle, sourceLlvmValueBundle);
        }
        if(entry.aux.blockedOperations.size > 0) {
            popStackFrame(context, entry, 'Blocked');
            return;
        }
        if(entry.aux.unsatisfiedOperations.size > 0)
            throwError(context, entry.symbol, 'Topological sort failed: Operations are not a DAG');
        unbundleAndMixOperands(context, entry, 'output');
        if(entry.aux.llvmBasicBlock.instructions.length > 0 || entry.aux.outputLlvmValues.size > 0) {
            const returnLlvmValue = buildLlvmBundle(context, entry.aux.llvmBasicBlock, Array.from(entry.aux.outputLlvmValues.values()));
            buildLLVMFunction(context, entry, returnLlvmValue, false);
        }
        finishExecution(context, entry);
    };
    for(const triple of context.backend.queryTriples(context.backend.queryMasks.MMV, [entry.operator, context.backend.symbolByName.Operation, context.backend.symbolByName.Void]))
        collectDestinations(context, entry, triple[2]);
    collectDestinations(context, entry, entry.operator);
    propagateSources(context, entry, entry.operator, entry.inputOperands, entry.aux.inputLlvmValues, entry.inputOperandBundle, entry.aux.inputLlvmValueBundle);
    entry.aux.resume();
}

export function buildLlvmBundle(context, llvmBasicBlock, llvmValues) {
    if(llvmValues.length < 2)
        return (llvmValues.length === 1) ? llvmValues[0] : LLVMVoidConstant;
    const dataType = new LLVMStructureType(llvmValues.map(value => value.type));
    let bundleLlvmValue = new LLVMLiteralConstant(dataType);
    llvmValues.forEach(function(llvmValue, index) {
        const instruction = new LLVMInsertValueInstruction(new LLVMValue(bundleLlvmValue.type), bundleLlvmValue, [index], llvmValue);
        llvmBasicBlock.instructions.push(instruction);
        bundleLlvmValue = instruction.result;
    });
    return bundleLlvmValue;
}

export function buildLlvmUnbundle(context, llvmBasicBlock, llvmValues, bundleLlvmValue) {
    if(llvmValues.length < 2)
        return (llvmValues.length === 1) ? llvmValues[0] : LLVMVoidConstant;
    if(!bundleLlvmValue) {
        const dataType = new LLVMStructureType(llvmValues.map(value => value.type));
        bundleLlvmValue = new LLVMValue(dataType);
    }
    llvmValues.forEach(function(llvmValue, index) {
        llvmBasicBlock.instructions.push(new LLVMExtractValueInstruction(llvmValue, bundleLlvmValue, [index]));
    });
    return bundleLlvmValue;
}

export function unbundleAndMixOperands(context, entry, direction) {
    const operands = entry[direction+'Operands'],
          llvmValues = entry.aux[direction+'LlvmValues'];
    if(!operands.has(context.backend.symbolByName.OperandBundle))
        return;
    const bundleOperands = unbundleOperands(context, operands.get(context.backend.symbolByName.OperandBundle)),
          bundleLlvmValue = llvmValues.get(context.backend.symbolByName.OperandBundle);
    operands.delete(context.backend.symbolByName.OperandBundle);
    llvmValues.delete(context.backend.symbolByName.OperandBundle);
    for(const [operandTag, operand] of bundleOperands)
        if(operands.has(operandTag))
            throwError(context, operandTag, 'DestinationOperandTag collision detected');
        else
            operands.set(operandTag, operand);
    const bundleLlvmValues = operandsToLlvmValues(context, bundleOperands);
    buildLlvmUnbundle(context, entry.aux.llvmBasicBlock, Array.from(bundleLlvmValues.values()), bundleLlvmValue);
    for(const [operandTag, llvmValue] of bundleLlvmValues)
        llvmValues.set(operandTag, llvmValue);
    entry[direction+'Operands'] = Utils.sorted(operands);
    entry.aux[direction+'LlvmValues'] = Utils.sorted(llvmValues);
}

export function buildLlvmCall(context, llvmBasicBlock, entry, operation, destinationOperands, destinationLlvmValues) {
    const operator = destinationOperands.get(context.backend.symbolByName.Operator);
    log(context, [operation, operator], 'Operation');
    let instanceEntry;
    const operatorLlvmValue = destinationLlvmValues.has(context.backend.symbolByName.Operator);
    if(operatorLlvmValue) {
        // TODO
        if(operatorLlvmValue.type instanceof LLVMFunctionType) {
            // TODO LLVMFunctionType
            throwError(context, operator, 'Calling LLVMFunctionType is not implemented yet');
        } else if(operatorLlvmValue.type == LLVMSymbolType) {
            // TODO
            throwError(context, operator, 'Dynamic operator dispatching is not implemented yet');
        } else
            throwError(context, operator, 'Invalid dynamic operator');
    }
    instanceEntry = context.execute(destinationOperands);
    if(instanceEntry.aux && !instanceEntry.aux.ready) {
        let operationsBlockedByThis = instanceEntry.aux.operationsBlockedByThis.get(entry);
        if(!operationsBlockedByThis) {
            operationsBlockedByThis = new Set();
            instanceEntry.aux.operationsBlockedByThis.set(entry, operationsBlockedByThis);
        }
        operationsBlockedByThis.add(operation);
        entry.aux.blockedOperations.add(operation);
        return [instanceEntry, false, undefined];
    }
    const instructionIndex = llvmBasicBlock.instructions.length,
          sourceLlvmValues = operandsToLlvmValues(context, instanceEntry.outputOperands),
          sourceLlvmValueBundle = buildLlvmUnbundle(context, llvmBasicBlock, Array.from(sourceLlvmValues.values()));
    if(instanceEntry.llvmFunction) {
        const callInstruction = new LLVMCallInstruction(sourceLlvmValueBundle, instanceEntry.llvmFunction, Array.from(destinationLlvmValues.values()));
        llvmBasicBlock.instructions.splice(instructionIndex, 0, callInstruction);
    }
    log(context, instanceEntry.outputOperands, 'Outputs');
    return [instanceEntry, sourceLlvmValues, sourceLlvmValueBundle];
}

export function buildLLVMFunction(context, entry, returnValue, alwaysinline=true) {
    if(!returnValue)
        returnValue = LLVMVoidConstant;
    entry.aux.llvmBasicBlock.instructions.push(new LLVMReturnInstruction(returnValue));
    entry.llvmFunction = new LLVMFunction('_'+entry.symbol.replace(':', '_'), returnValue.type, entry.aux.llvmFunctionParameters, [entry.aux.llvmBasicBlock]);
    if(alwaysinline)
        entry.llvmFunction.attributes.push('alwaysinline');
    entry.llvmFunction.linkage = 'private';
}

export function finishExecution(context, entry) {
    popStackFrame(context, entry, 'Done');
    if(entry.llvmFunction)
        context.llvmModule.functions.push(entry.llvmFunction);
    const operationsBlockedByThis = entry.aux.operationsBlockedByThis;
    delete entry.aux;
    entry.outputOperandBundle = bundleOperands(context, entry.outputOperands);
    context.backend.setTriple([entry.symbol, context.backend.symbolByName.OutputOperandBundle, entry.outputOperandBundle], true);
    if(operationsBlockedByThis)
        for(const [blockedEntry, operations] of operationsBlockedByThis) {
            for(const operation of operations) {
                blockedEntry.aux.blockedOperations.delete(operation);
                blockedEntry.aux.readyOperations.push(operation);
            }
            pushStackFrame(context, blockedEntry, 'Resume');
            blockedEntry.aux.resume();
        }
}

export function pointerCast(addressLlvmValue, llymType) {
    if(!(addressLlvmValue.type instanceof LLVMIntegerType) && !(addressLlvmValue.type instanceof LLVMPointerType))
        throwError(context, 'Address is not a natural number or pointer');
    const pointerLlvmValue = new LLVMValue(new LLVMPointerType(llymType));
    return (addressLlvmValue.type instanceof LLVMIntegerType)
        ? new LLVMCastInstruction(pointerLlvmValue, 'inttoptr', addressLlvmValue)
        : new LLVMCastInstruction(pointerLlvmValue, 'bitcast', addressLlvmValue);
}
