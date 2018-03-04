import { LLVMStructureType } from './LLVM/Type.js';
import { LLVMValue, LLVMLiteralConstant, LLVMFunction } from './LLVM/Value.js';
import { LLVMReturnInstruction, LLVMExtractValueInstruction, LLVMInsertValueInstruction, LLVMCallInstruction } from './LLVM/Instruction.js';
import { LLVMVoidConstant, encodingToLlvmType, constantToLlvmConstant } from './values.js';
import { execute } from './execution.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export function linkOperandTriples(context, entry, attribute) {
    const operandsSymbol = context.ontology.createSymbol(context.executionNamespaceId),
          operands = (attribute === BasicBackend.symbolByName.InputOperands) ? entry.inputOperands : entry.outputOperands;
    for(const [operandTag, operand] of operands)
        context.ontology.setTriple([operandsSymbol, operandTag, operand], true);
    context.ontology.setTriple([entry.symbol, attribute, operandsSymbol], true);
}

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

export function deferEvaluation(context, sourceOperand) {
    const sourceLlvmValue = constantToLlvmConstant(context, sourceOperand),
          sourceLlvmType = sourceLlvmValue.type.serialize();
    sourceOperand = context.runtimeValueCache.get(sourceLlvmType);
    if(!sourceOperand) {
        const runtimeEncoding = context.ontology.getSolitary(sourceOperand, BasicBackend.symbolByName.Encoding);
        sourceOperand = context.ontology.createSymbol(context.executionNamespaceId);
        context.ontology.setTriple([sourceOperand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.RuntimeValue], true);
        context.ontology.setTriple([sourceOperand, BasicBackend.symbolByName.RuntimeEncoding, runtimeEncoding], true);
        context.runtimeValueCache.set(sourceLlvmType, sourceOperand);
    }
    return [sourceOperand, sourceLlvmValue];
}

export function convertSources(context, sourceOperands) {
    const sourceLlvmValues = new Map();
    for(const [sourceOperandTag, sourceOperand] of sourceOperands)
        if(context.ontology.getTriple([sourceOperand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.RuntimeValue])) {
            const llvmType = encodingToLlvmType(context, context.ontology.getSolitary(sourceOperand, BasicBackend.symbolByName.RuntimeEncoding));
            sourceLlvmValues.set(sourceOperandTag, new LLVMValue(llvmType));
        }
    return sourceLlvmValues;
}

export function getRuntimeValue(context, sourceOperandTag, sourceOperands, sourceLlvmValues) {
    const sourceOperand = sourceOperands.get(sourceOperandTag);
    return (sourceLlvmValues.has(sourceOperandTag))
        ? [sourceOperand, sourceLlvmValues.get(sourceOperandTag)]
        : deferEvaluation(context, sourceOperand);
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
            if(context.ontology.getTriple([sourceOperand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.RuntimeValue]))
                throw new Error('Const carrier uses a RuntimeValue as source operand');
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
    const returnLlvmValue = (sourceLlvmValues.size > 1) ? new LLVMValue(instanceEntry.llvmFunction.returnType) :
                            ((sourceLlvmValues.size === 1) ? sourceLlvmValues.values().next().value : LLVMVoidConstant);
    llvmBasicBlock.instructions.push(new LLVMCallInstruction(returnLlvmValue, instanceEntry.llvmFunction, Array.from(destinationLlvmValues.values())));
    if(sourceLlvmValues.size > 1) {
        let index = 0;
        for(const llvmSource of sourceLlvmValues.values())
            llvmBasicBlock.instructions.push(new LLVMExtractValueInstruction(llvmSource, returnLlvmValue, [index++]));
    }
    return [instanceEntry, sourceLlvmValues];
}

export function buildLLVMFunction(context, entry, returnType, alwaysinline=true) {
    entry.llvmFunction = new LLVMFunction(`"${entry.symbol}"`, returnType, Array.from(entry.aux.inputLlvmValues.values()), [entry.aux.llvmBasicBlock]);
    if(alwaysinline)
        entry.llvmFunction.attributes.push('alwaysinline');
    entry.llvmFunction.linkage = 'private';
}

export function buildLLVMReturn(context, entry) {
    let returnLlvmValue;
    if(entry.aux.outputLlvmValues.size > 1) {
        const dataType = new LLVMStructureType(Array.from(entry.aux.outputLlvmValues.values()).map(value => value.type));
        returnLlvmValue = new LLVMLiteralConstant(dataType);
        let index = 0;
        for(const llvmDestination of entry.aux.outputLlvmValues.values()) {
            const instruction = new LLVMInsertValueInstruction(new LLVMValue(returnLlvmValue.type), returnLlvmValue, [index++], llvmDestination);
            entry.aux.llvmBasicBlock.instructions.push(instruction);
            returnLlvmValue = instruction.result;
        }
    } else
        returnLlvmValue = (entry.aux.outputLlvmValues.size === 1) ? entry.aux.outputLlvmValues.values().next().value : LLVMVoidConstant;
    entry.aux.llvmBasicBlock.instructions.push(new LLVMReturnInstruction(returnLlvmValue));
    return returnLlvmValue;
}

export function finishExecution(context, entry) {
    if(entry.llvmFunction)
        context.llvmModule.functions.push(entry.llvmFunction);
    const operationsBlockedByThis = entry.aux.operationsBlockedByThis;
    delete entry.aux;
    linkOperandTriples(context, entry, BasicBackend.symbolByName.OutputOperands);
    if(operationsBlockedByThis)
        for(const [blockedEntry, operations] of operationsBlockedByThis) {
            for(const operation of operations) {
                blockedEntry.aux.blockedOperations.delete(operation);
                blockedEntry.aux.readyOperations.push(operation);
            }
            blockedEntry.aux.resume();
        }
}
