import { LLVMType, LLVMIntegerType, LLVMFloatType, LLVMPointerType, LLVMCompositeType, LLVMVectorType, LLVMArrayType, LLVMStructureType } from './LLVM/Type.js';
import { LLVMValue, LLVMConstant, LLVMLiteralConstant, LLVMTextConstant, LLVMCompositeConstant } from './LLVM/Value.js';
import { log, throwError, throwWarning } from './stackTrace.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export const LLVMSymbolType = new LLVMStructureType([new LLVMIntegerType(32), new LLVMIntegerType(32)]),
             LLVMVoidConstant = new LLVMLiteralConstant(new LLVMType('void'));

export function bundleOperands(context, operands) {
    const bundleSymbol = context.ontology.createSymbol(context.namespaceId);
    context.ontology.setTriple([bundleSymbol, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.OperandBundle], true);
    for(const [operandTag, operand] of operands) {
        const pairSymbol = context.ontology.createSymbol(context.namespaceId);
        context.ontology.setTriple([pairSymbol, BasicBackend.symbolByName.OperandTag, operandTag], true);
        context.ontology.setTriple([pairSymbol, BasicBackend.symbolByName.Operand, operand], true);
        context.ontology.setTriple([bundleSymbol, BasicBackend.symbolByName.Element, pairSymbol], true);
    }
    return bundleSymbol;
}

export function unbundleOperands(context, bundleSymbol) {
    const operands = new Map();
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.MMV, [bundleSymbol, BasicBackend.symbolByName.Element, BasicBackend.symbolByName.Void]))
        operands.set(context.ontology.getSolitary(triple[2], BasicBackend.symbolByName.OperandTag), context.ontology.getSolitary(triple[2], BasicBackend.symbolByName.Operand));
    operands.delete(BasicBackend.symbolByName.Type);
    return operands;
}

function llvmTypeOfEncoding(context, encoding, length) {
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
        throwError(context, encoding, 'Encoding must be a Composite to describe a LLVMType');

    let slotSize = context.ontology.getSolitary(encoding, BasicBackend.symbolByName.SlotSize);
    if(slotSize === BasicBackend.symbolByName.Dynamic)
        throwError(context, encoding, 'LLVM does not support a Dynamic SlotSize');
    else if(slotSize !== BasicBackend.symbolByName.Void)
        slotSize = context.ontology.getData(slotSize);

    const defaultEncoding = context.ontology.getSolitary(encoding, BasicBackend.symbolByName.Default),
          defaultDataType = llvmTypeOfEncoding(context, defaultEncoding, slotSize);

    let count = context.ontology.getSolitary(encoding, BasicBackend.symbolByName.Count);
    if(count === BasicBackend.symbolByName.Dynamic)
        throwError(context, encoding, 'LLVM does not support a Dynamic Count');
    else if(count === BasicBackend.symbolByName.Void)
        return new LLVMPointerType(defaultDataType);
    count = context.ontology.getData(count);

    if(defaultEncoding !== BasicBackend.symbolByName.Void) {
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
        childDataTypes.push(llvmTypeOfEncoding(context, childEncoding, slotSize));
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
            const llvmType = llvmTypeOfEncoding(context, context.ontology.getSolitary(operand, BasicBackend.symbolByName.PlaceholderEncoding));
            switch(mode) {
                case LLVMType:
                    return llvmType;
                case LLVMValue:
                    return new LLVMValue(llvmType);
                case LLVMConstant:
                    return new LLVMLiteralConstant(llvmType);
            }
        }
        case BasicBackend.symbolByName.OperandBundle: {
            const results = Array.from(unbundleOperands(context, operand).values())
                .map(operand => operandToLlvm(context, operand, mode))
                .filter(result => result && result !== LLVMVoidConstant && result !== LLVMVoidConstant.type);
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
            const dataType = llvmTypeOfEncoding(context, encoding, length);
            return (mode === LLVMType) ? dataType : dataValueToLlvmConstant(dataType, context.ontology.getData(operand));
        }
    }
}

function convertToTypedPlaceholder(context, operand) {
    if(context.ontology.getTriple([operand, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.OperandBundle])) {
        const operands = unbundleOperands(context, operand);
        if(operands.size > 1) {
            let index = 0;
            for(const [operandTag, operand] of operands)
                operands.set(operandTag, convertToTypedPlaceholder(context, operand));
        } else if(operands.size === 1)
            operands.set(operands.keys().next().value, convertToTypedPlaceholder(context, operands.values().next().value));
        return bundleOperands(context, operands);
    }
    const encoding = context.ontology.getSolitary(operand, BasicBackend.symbolByName.Encoding),
          size = context.ontology.getLength(operand),
          key = encoding+','+size;
    if(context.typedPlaceholderCache.has(key))
        return context.typedPlaceholderCache.get(key);
    const typedPlaceholder = context.ontology.createSymbol(context.namespaceId),
          placeholderEncoding = context.ontology.createSymbol(context.namespaceId),
          slotSize = context.ontology.createSymbol(context.namespaceId);
    throwWarning(context, 'TypedPlaceholder construction is experimental');
    context.ontology.setData(slotSize, size);
    context.ontology.setTriple([typedPlaceholder, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.TypedPlaceholder], true);
    context.ontology.setTriple([typedPlaceholder, BasicBackend.symbolByName.PlaceholderEncoding, placeholderEncoding], true);
    context.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.Composite], true);
    context.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Count, BasicBackend.symbolByName.One], true);
    context.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.SlotSize, slotSize], true);
    context.ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Default, encoding], true);
    context.typedPlaceholderCache.set(key, typedPlaceholder);
    return typedPlaceholder;
}

export function llvmTypeAndTypedPlaceholderOfEncoding(context, encoding, length) {
    return [llvmTypeOfEncoding(context, encoding, length), context.typedPlaceholderCache.get(encoding+','+length)];
}

export function getLlvmValue(context, operandTag, operands, llvmValues) {
    const operand = operands.get(operandTag);
    if(!operand)
        throwError(context, operandTag, 'Expected Input Operand is missing');
    return (llvmValues.has(operandTag))
        ? [operand, llvmValues.get(operandTag)]
        : [convertToTypedPlaceholder(context, operand), operandToLlvm(context, operand, LLVMConstant)];
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
