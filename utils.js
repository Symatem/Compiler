import { LLVMStructureType } from './LLVM/Type.js';
import { LLVMValue, LLVMLiteralConstant, LLVMFunction } from './LLVM/Value.js';
import { LLVMExtractValueInstruction, LLVMInsertValueInstruction, LLVMCallInstruction } from './LLVM/Instruction.js';
import { LLVMVoidConstant, convertSources } from './values.js';
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

export function bundleOperands(context, operands) {
    const bundleSymbol = context.ontology.createSymbol(context.executionNamespaceId);
    context.ontology.setTriple([bundleSymbol, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.CarrierBundle], true);
    for(const [operandTag, operand] of operands)
        context.ontology.setTriple([bundleSymbol, operandTag, operand], true);
    return bundleSymbol;
}

export function unbundleOperands(context, bundleSymbol) {
    const operands = new Map();
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.MVV, [bundleSymbol, BasicBackend.symbolByName.Void, BasicBackend.symbolByName.Void]))
        operands.set(triple[1], triple[2]);
    operands.delete(BasicBackend.symbolByName.Type);
    return operands;
}

export function bundleLLVMValues(context, llvmBasicBlock, destinationLlvmValues) {
    if(destinationLlvmValues.length < 2)
        return (destinationLlvmValues.length === 1) ? destinationLlvmValues[0] : LLVMVoidConstant;
    const dataType = new LLVMStructureType(destinationLlvmValues.map(value => value.type));
    let sourceLlvmValue = new LLVMLiteralConstant(dataType);
    destinationLlvmValues.forEach(function(destinationLlvmValue, index) {
        const instruction = new LLVMInsertValueInstruction(new LLVMValue(sourceLlvmValue.type), sourceLlvmValue, [index], destinationLlvmValue);
        llvmBasicBlock.instructions.push(instruction);
        sourceLlvmValue = instruction.result;
    });
    return sourceLlvmValue;
}

export function unbundleLLVMValues(context, llvmBasicBlock, sourceLlvmValues) {
    if(sourceLlvmValues.length < 2)
        return (sourceLlvmValues.length === 1) ? sourceLlvmValues[0] : LLVMVoidConstant;
    const dataType = new LLVMStructureType(sourceLlvmValues.map(value => value.type)),
          destinationLlvmValue = new LLVMValue(dataType);
    sourceLlvmValues.forEach(function(sourceLlvmValue, index) {
        llvmBasicBlock.instructions.push(new LLVMExtractValueInstruction(sourceLlvmValue, destinationLlvmValue, [index]));
    });
    return destinationLlvmValue;
}

export function collectDestinations(context, entry, destinationOperat) {
    let carriers = new Map(),
        referenceCount = 0;
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.VMM, [BasicBackend.symbolByName.Void, BasicBackend.symbolByName.DestinationOperat, destinationOperat]))
        carriers.set(context.ontology.getSolitary(triple[0], BasicBackend.symbolByName.DestinationOperandTag), triple[0]);
    carriers = carriers.sorted();
    const destinationOperands = (destinationOperat === entry.operator) ? entry.outputOperands : new Map(),
          destinationLlvmValues = new Map();
    for(const [destinationOperandTag, carrier] of carriers) {
        let destinationOperand;
        const sourceOperandTag = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.SourceOperandTag);
        if(sourceOperandTag === BasicBackend.symbolByName.Constant) {
            const sourceOperand = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.SourceOperat);
            if(context.ontology.getTriple([sourceOperand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.TypedPlaceholder]))
                throw new Error('Const carrier uses a TypedPlaceholder as source operand');
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

export function propagateSources(context, entry, sourceOperat, sourceOperands, sourceLlvmValues) {
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.VMM, [BasicBackend.symbolByName.Void, BasicBackend.symbolByName.SourceOperat, sourceOperat])) {
        const carrier = triple[0],
              sourceOperandTag = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.SourceOperandTag);
        if(sourceOperandTag === BasicBackend.symbolByName.Constant)
            continue;
        const sourceOperand = sourceOperands.get(sourceOperandTag),
              sourceLlvmValue = sourceLlvmValues.get(sourceOperandTag),
              destinationOperandTag = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.DestinationOperandTag),
              destinationOperat = context.ontology.getSolitary(carrier, BasicBackend.symbolByName.DestinationOperat),
              destinationLlvmValues = entry.aux.operatDestinationLlvmValues.get(destinationOperat);
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
}

export function buildLlvmCall(context, entry, operation, llvmBasicBlock, destinationOperands, destinationLlvmValues) {
    let instanceEntry, sourceLlvmValues;
    if(destinationLlvmValues.has(BasicBackend.symbolByName.Operator)) {
        throw new Error('Calling LLVMFunctionType is not implemented yet');
        instanceEntry = {};
        // TODO: LLVMFunctionType
    } else {
        instanceEntry = execute(context, destinationOperands);
        if(instanceEntry.aux && !instanceEntry.aux.ready) {
            let operationsBlockedByThis = instanceEntry.aux.operationsBlockedByThis.get(entry);
            if(!operationsBlockedByThis) {
                operationsBlockedByThis = new Set();
                instanceEntry.aux.operationsBlockedByThis.set(entry, operationsBlockedByThis);
            }
            operationsBlockedByThis.add(operation);
            entry.aux.blockedOperations.add(operation);
            return [instanceEntry, false];
        }
        if(!instanceEntry.llvmFunction)
            return [instanceEntry, new Map()];
        sourceLlvmValues = convertSources(context, instanceEntry.outputOperands);
    }
    const callInstruction = new LLVMCallInstruction(undefined, instanceEntry.llvmFunction, Array.from(destinationLlvmValues.values()));
    llvmBasicBlock.instructions.push(callInstruction);
    callInstruction.result = unbundleLLVMValues(context, llvmBasicBlock, Array.from(sourceLlvmValues.values()));
    return [instanceEntry, sourceLlvmValues];
}

export function buildLLVMFunction(context, entry, returnType, alwaysinline=true) {
    entry.llvmFunction = new LLVMFunction(`"${entry.symbol}"`, returnType, Array.from(entry.aux.inputLlvmValues.values()), [entry.aux.llvmBasicBlock]);
    if(alwaysinline)
        entry.llvmFunction.attributes.push('alwaysinline');
    entry.llvmFunction.linkage = 'private';
}

export function finishExecution(context, entry) {
    if(entry.llvmFunction)
        context.llvmModule.functions.push(entry.llvmFunction);
    const operationsBlockedByThis = entry.aux.operationsBlockedByThis;
    delete entry.aux;
    context.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.OutputOperands, bundleOperands(context, entry.outputOperands)], true);
    if(operationsBlockedByThis)
        for(const [blockedEntry, operations] of operationsBlockedByThis) {
            for(const operation of operations) {
                blockedEntry.aux.blockedOperations.delete(operation);
                blockedEntry.aux.readyOperations.push(operation);
            }
            blockedEntry.aux.resume();
        }
}
