import { LLVMStructureType } from './LLVM/Type.js';
import { LLVMValue, LLVMLiteralConstant, LLVMFunction } from './LLVM/Value.js';
import { LLVMExtractValueInstruction, LLVMInsertValueInstruction, LLVMCallInstruction, LLVMReturnInstruction } from './LLVM/Instruction.js';
import { LLVMSymbolType, LLVMVoidConstant, bundleOperands, unbundleOperands, operandsToLlvmValues } from './values.js';
import { execute } from './execution.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export function hashOfOperands(context, operands) {
    let i = 0, dataLength = operands.size*32*5;
    for(const [operandTag, operand] of operands)
        dataLength += Math.ceil(context.ontology.getLength(operand)/8)*8;
    const dataBytes = new Uint8Array(Math.ceil(dataLength/8)),
          view = new DataView(dataBytes.buffer);
    for(const [operandTag, operand] of operands) {
        const operandDataBytes = context.ontology.getRawData(operand);
        view.setUint32(i, BasicBackend.namespaceOfSymbol(operandTag), true);
        view.setUint32(i+4, BasicBackend.identityOfSymbol(operandTag), true);
        view.setUint32(i+8, BasicBackend.namespaceOfSymbol(operand), true);
        view.setUint32(i+12, BasicBackend.identityOfSymbol(operand), true);
        view.setUint32(i+16, operandDataBytes.byteLength, true);
        i += 20;
        dataBytes.set(operandDataBytes, i);
        i += operandDataBytes.byteLength;
    }
    return view.djb2Hash();
}

export function renamedOperands(destinationOperands, destinationLlvmValues, entry, operandTags) {
    for(const [dstOperandTag, srcOperandTag] of operandTags) {
        destinationOperands.set(dstOperandTag, entry.inputOperands.get(srcOperandTag));
        const llvmValue = entry.aux.inputLlvmValues.get(srcOperandTag);
        if(llvmValue)
            destinationLlvmValues.set(dstOperandTag, llvmValue);
    }
}

export function collectDestinations(context, entry, destinationOperat) {
    let carriers = new Map(),
        referenceCount = 0;
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.VMM, [BasicBackend.symbolByName.Void, BasicBackend.symbolByName.DestinationOperat, destinationOperat])) {
        const destinationOperandTag = context.ontology.getSolitary(triple[0], BasicBackend.symbolByName.DestinationOperandTag);
        if(carriers.has(destinationOperandTag))
            context.throwError('DestinationOperandTag collision detected');
        carriers.set(destinationOperandTag, triple[0]);
    }
    carriers = carriers.sorted();
    const destinationOperands = (destinationOperat === entry.operator) ? entry.outputOperands : new Map(),
          destinationLlvmValues = new Map();
    for(const [destinationOperandTag, carrier] of carriers) {
        let destinationOperand;
        const sourceOperandTag = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.SourceOperandTag);
        if(sourceOperandTag === BasicBackend.symbolByName.Constant) {
            const sourceOperand = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.SourceOperat);
            if(context.ontology.getTriple([sourceOperand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.TypedPlaceholder]))
                context.throwError('Const carrier uses a TypedPlaceholder as source operand');
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
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.VMM, [BasicBackend.symbolByName.Void, BasicBackend.symbolByName.SourceOperat, sourceOperat])) {
        const carrier = triple[0],
              sourceOperandTag = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.SourceOperandTag);
        if(sourceOperandTag === BasicBackend.symbolByName.Constant)
            continue;
        unusedOperandTags.delete(sourceOperandTag);
        let sourceOperand = sourceOperands.get(sourceOperandTag),
            sourceLlvmValue = sourceLlvmValues.get(sourceOperandTag);
        if(sourceOperandTag === BasicBackend.symbolByName.Operands) {
            unusedOperandTags.clear();
            sourceOperand = sourceOperandBundle;
            sourceLlvmValue = sourceLlvmValueBundle;
        }
        const destinationOperandTag = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.DestinationOperandTag),
              destinationOperat = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.DestinationOperat),
              destinationLlvmValues = entry.aux.operatDestinationLlvmValues.get(destinationOperat);
        if(sourceOperand && sourceLlvmValue)
            destinationLlvmValues.set(destinationOperandTag, sourceLlvmValue);
        else
            destinationLlvmValues.delete(destinationOperandTag);
        if(!sourceOperand) {
            sourceOperand = BasicBackend.symbolByName.Void;
            context.throwWarning('Operand not found. Using Void as fallback');
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
        context.throwWarning(unusedOperandTags.size+' unused operand(s)');
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
    if(!operands.has(BasicBackend.symbolByName.Operands))
        return;
    const bundleOperands = unbundleOperands(context, operands.get(BasicBackend.symbolByName.Operands)),
          bundleLlvmValue = llvmValues.get(BasicBackend.symbolByName.Operands);
    operands.delete(BasicBackend.symbolByName.Operands);
    llvmValues.delete(BasicBackend.symbolByName.Operands);
    for(const [operandTag, operand] of bundleOperands)
        if(operands.has(operandTag))
            context.throwError('DestinationOperandTag collision detected');
        else
            operands.set(operandTag, operand);
    const bundleLlvmValues = operandsToLlvmValues(context, bundleOperands);
    buildLlvmUnbundle(context, entry.aux.llvmBasicBlock, Array.from(bundleLlvmValues.values()), bundleLlvmValue);
    for(const [operandTag, llvmValue] of bundleLlvmValues)
        llvmValues.set(operandTag, llvmValue);
    entry[direction+'Operands'] = operands.sorted();
    entry.aux[direction+'LlvmValues'] = llvmValues.sorted();
}

export function buildLlvmCall(context, llvmBasicBlock, entry, operation, destinationOperands, destinationLlvmValues) {
    let instanceEntry;
    const operatorLlvmValue = destinationLlvmValues.has(BasicBackend.symbolByName.Operator);
    if(operatorLlvmValue) {
        // TODO
        if(operatorLlvmValue.type instanceof LLVMFunctionType) {
            // TODO LLVMFunctionType
            context.throwError('Calling LLVMFunctionType is not implemented yet');
        } else if(operatorLlvmValue.type == LLVMSymbolType) {
            // TODO
            context.throwError('Dynamic operator dispatching is not implemented yet');
        } else
            context.throwError('Invalid dynamic operator');
    }
    instanceEntry = execute(context, destinationOperands);
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
    const sourceLlvmValues = operandsToLlvmValues(context, instanceEntry.outputOperands),
          sourceLlvmValueBundle = buildLlvmUnbundle(context, llvmBasicBlock, Array.from(sourceLlvmValues.values()));
    if(instanceEntry.llvmFunction) {
        const callInstruction = new LLVMCallInstruction(undefined, instanceEntry.llvmFunction, Array.from(destinationLlvmValues.values()));
        llvmBasicBlock.instructions.push(callInstruction);
        callInstruction.result = sourceLlvmValueBundle;
    }
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
    context.popStackFrame(entry, 'Done');
    if(entry.llvmFunction)
        context.llvmModule.functions.push(entry.llvmFunction);
    const operationsBlockedByThis = entry.aux.operationsBlockedByThis;
    delete entry.aux;
    entry.outputOperandBundle = bundleOperands(context, entry.outputOperands);
    context.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.OutputOperands, entry.outputOperandBundle], true);
    if(operationsBlockedByThis)
        for(const [blockedEntry, operations] of operationsBlockedByThis) {
            for(const operation of operations) {
                blockedEntry.aux.blockedOperations.delete(operation);
                blockedEntry.aux.readyOperations.push(operation);
            }
            context.pushStackFrame(blockedEntry, 'Resume');
            blockedEntry.aux.resume();
        }
}
