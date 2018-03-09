import { LLVMType, LLVMIntegerType, LLVMFloatType, LLVMPointerType, LLVMCompositeType, LLVMVectorType, LLVMArrayType, LLVMStructureType } from './LLVM/Type.js';
import { LLVMValue, LLVMConstant, LLVMLiteralConstant, LLVMTextConstant, LLVMCompositeConstant } from './LLVM/Value.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export const LLVMSymbolType = new LLVMStructureType([new LLVMIntegerType(32), new LLVMIntegerType(32)]),
             LLVMVoidConstant = new LLVMLiteralConstant(new LLVMType('void'));

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

export function encodingToLlvmType(context, encoding, length) {
    // TODO: LLVMFunctionType
    if(Number.isInteger(length) && length >= 0)
        switch(encoding) {
            case BasicBackend.symbolByName.Void:
                return LLVMVoidConstant.type;
            case BasicBackend.symbolByName.BinaryNumber:
            case BasicBackend.symbolByName.TwosComplement:
                return new LLVMIntegerType(length);
            case BasicBackend.symbolByName.IEEE754:
                return new LLVMFloatType(length);
            case BasicBackend.symbolByName.UTF8:
                return new LLVMArrayType(length/8, new LLVMIntegerType(8));
        }
    if(!context.ontology.getTriple([encoding, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.Composite]))
        throw new Error('Encoding must be a Composite to describe a LLVMType');

    let slotSize = context.ontology.getSolitary(encoding, BasicBackend.symbolByName.SlotSize);
    if(slotSize === BasicBackend.symbolByName.Dynamic)
        throw new Error('LLVM does not support a Dynamic SlotSize');
    else if(slotSize !== BasicBackend.symbolByName.Void)
        slotSize = context.ontology.getData(slotSize);

    const defaultEncoding = context.ontology.getSolitary(encoding, BasicBackend.symbolByName.Default);

    let count = context.ontology.getSolitary(encoding, BasicBackend.symbolByName.Count);
    if(count === BasicBackend.symbolByName.Dynamic)
        throw new Error('LLVM does not support a Dynamic Count');
    else if(count === BasicBackend.symbolByName.Void)
        return new LLVMPointerType(defaultDataType);

    count = context.ontology.getData(count);
    if(defaultEncoding !== BasicBackend.symbolByName.Void) {
        const defaultDataType = encodingToLlvmType(context, defaultEncoding, slotSize);
        if(context.ontology.getTriple([encoding, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.Vector]))
            return new LLVMVectorType(count, defaultDataType);
        else if(count === 1)
            return defaultDataType;
        else
            return new LLVMArrayType(count, defaultDataType);
    }

    const childDataTypes = [];
    for(let i = 0; i < count; ++i) {
        const childEncoding = context.ontology.getSolitary(encoding, BasicBackend.symbolInNamespace('Index', i));
        childDataTypes.push(encodingToLlvmType(context, childEncoding, slotSize));
    }
    return (childDataTypes.length === 1)
           ? childDataTypes[0]
           : new LLVMStructureType(childDataTypes, true);
}

function dataValueToLlvmConstant(dataType, dataValue) {
    if(typeof dataValue === 'string')
        return new LLVMTextConstant(dataType, dataValue);
    if(dataType instanceof LLVMCompositeType) {
        for(let i = 0; i < dataValue.length; ++i)
            dataValue[i] = dataValueToLlvmConstant((dataType instanceof LLVMStructureType) ? dataType.referencedTypes[i] : dataType.referencedType, dataValue[i]);
        return new LLVMCompositeConstant(dataType, dataValue);
    }
    return new LLVMLiteralConstant(dataType, dataValue);
}

function operandToLlvm(context, operand, mode) {
    switch(context.ontology.getSolitary(operand, BasicBackend.symbolByName.Type)) {
        case BasicBackend.symbolByName.OperatorInstance: {
            if(mode === LLVMValue)
                return;
            const llvmConstant = context.operatorInstanceBySymbol.get(operand).llvmFunction;
            return (mode === LLVMType) ? llvmConstant.type : llvmConstant;
        }
        case BasicBackend.symbolByName.TypedPlaceholder: {
            const llvmType = encodingToLlvmType(context, context.ontology.getSolitary(operand, BasicBackend.symbolByName.PlaceholderEncoding));
            switch(mode) {
                case LLVMType:
                    return llvmType;
                case LLVMValue:
                    return new LLVMValue(llvmType);
                case LLVMConstant:
                    return new LLVMLiteralConstant(llvmType);
            }
        }
        case BasicBackend.symbolByName.CarrierBundle: {
            const results = Array.from(unbundleOperands(context, operand).values())
                .map(operand => operandToLlvm(context, operand, mode))
                .filter(result => result && result !== LLVMVoidConstant && result.type !== LLVMVoidConstant);
            switch(results.length) {
                case 0:
                    switch(mode) {
                        case LLVMType:
                            return LLVMVoidConstant.type;
                        case LLVMValue:
                            return;
                        case LLVMConstant:
                            return LLVMVoidConstant;
                    }
                case 1:
                    return results[0];
                default: {
                    if(mode === LLVMType)
                        return new LLVMStructureType(results);
                    const llymType = new LLVMStructureType(results.map(llvmValue => llvmValue.type));
                    return (mode === LLVMValue) ? new LLVMValue(llymType) : new LLVMCompositeConstant(llymType, results);
                }
            }
        } default: {
            if(mode === LLVMValue)
                return;
            const encoding = context.ontology.getSolitary(operand, BasicBackend.symbolByName.Encoding),
                  length = context.ontology.getLength(operand);
            if(encoding === BasicBackend.symbolByName.Void && length === 0)
                return new LLVMCompositeConstant(LLVMSymbolType, [
                    new LLVMLiteralConstant(BasicBackend.namespaceOfSymbol(operand)),
                    new LLVMLiteralConstant(BasicBackend.identityOfSymbol(operand))
                ]);
            const dataType = encodingToLlvmType(context, encoding, length);
            return (mode === LLVMType) ? dataType : dataValueToLlvmConstant(dataType, context.ontology.getData(operand));
        }
    }
}

function convertToTypedPlaceholder(context, operand, llvmType) {
    const llvmTypeString = llvmType.serialize();
    if(context.typedPlaceholderCache.has(llvmTypeString))
        return context.typedPlaceholderCache.get(llvmTypeString);
    if(context.ontology.getTriple([operand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.CarrierBundle])) {
        const operands = unbundleOperands(context, operand);
        if(operands.size > 1) {
            let index = 0;
            for(const [operandTag, operand] of operands)
                operands.set(operandTag, convertToTypedPlaceholder(context, operand, llvmType.referencedTypes[index++]));
        } else if(operands.size === 1)
            operands.set(operands.keys().next().value, convertToTypedPlaceholder(context, operands.values().next().value, llvmType));
        return bundleOperands(context, operands);
    }
    const placeholderEncoding = context.ontology.getSolitary(operand, BasicBackend.symbolByName.Encoding);
    operand = context.ontology.createSymbol(context.executionNamespaceId);
    context.ontology.setTriple([operand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.TypedPlaceholder], true);
    context.ontology.setTriple([operand, BasicBackend.symbolByName.PlaceholderEncoding, placeholderEncoding], true);
    context.typedPlaceholderCache.set(sourceLlvmType, operand);
    return operand;
}

export function getLlvmValue(context, operandTag, operands, llvmValues) {
    const operand = operands.get(operandTag);
    if(llvmValues.has(operandTag))
        return [operand, llvmValues.get(operandTag)];
    const llvmValue = operandToLlvm(context, operand, LLVMConstant);
    return [convertToTypedPlaceholder(context, operand, llvmValue.type), llvmValue];
}

export function operandsToLlvmValues(context, sourceOperands) {
    const sourceLlvmValues = new Map();
    for(const [sourceOperandTag, sourceOperand] of sourceOperands) {
        const llvmValue = operandToLlvm(context, sourceOperand, LLVMValue);
        if(llvmValue)
            sourceLlvmValues.set(sourceOperandTag, llvmValue);
    }
    return sourceLlvmValues;
}
