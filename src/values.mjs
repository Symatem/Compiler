import { LLVMType, LLVMIntegerType, LLVMFloatType, LLVMPointerType, LLVMCompositeType, LLVMVectorType, LLVMArrayType, LLVMStructureType } from './LLVM/Type.mjs';
import { LLVMValue, LLVMConstant, LLVMLiteralConstant, LLVMTextConstant, LLVMCompositeConstant } from './LLVM/Value.mjs';
import { throwError, throwWarning } from './stackTrace.mjs';



export const LLVMSymbolType = new LLVMStructureType([new LLVMIntegerType(32), new LLVMIntegerType(32)]),
             LLVMVoidConstant = new LLVMLiteralConstant(new LLVMType('void'));

export function bundleOperands(context, operands) {
    const bundleSymbol = context.backend.createSymbol(context.namespaceId);
    context.backend.setTriple([bundleSymbol, context.backend.symbolByName.Type, context.backend.symbolByName.OperandBundle], true);
    for(const [operandTag, operand] of operands) {
        const pairSymbol = context.backend.createSymbol(context.namespaceId);
        context.backend.setTriple([pairSymbol, context.backend.symbolByName.OperandTag, operandTag], true);
        context.backend.setTriple([pairSymbol, context.backend.symbolByName.Operand, operand], true);
        context.backend.setTriple([bundleSymbol, context.backend.symbolByName.Element, pairSymbol], true);
    }
    return bundleSymbol;
}

export function unbundleOperands(context, bundleSymbol) {
    const operands = new Map();
    for(const triple of context.backend.queryTriples(context.backend.queryMasks.MMV, [bundleSymbol, context.backend.symbolByName.Element, context.backend.symbolByName.Void]))
        operands.set(context.backend.getPairOptionally(triple[2], context.backend.symbolByName.OperandTag), context.backend.getPairOptionally(triple[2], context.backend.symbolByName.Operand));
    operands.delete(context.backend.symbolByName.Type);
    return operands;
}

function llvmTypeOfEncoding(context, encoding, length) {
    // TODO: LLVMFunctionType
    if(Number.isInteger(length) && length >= 0)
        switch(encoding) {
            case context.backend.symbolByName.Void:
                return LLVMVoidConstant.type;
            case context.backend.symbolByName.BinaryNumber:
            case context.backend.symbolByName.TwosComplement:
                return new LLVMIntegerType(length);
            case context.backend.symbolByName.IEEE754:
                return new LLVMFloatType(length);
            case context.backend.symbolByName.UTF8:
                return new LLVMArrayType(length/8, new LLVMIntegerType(8));
        }
    if(!context.backend.getTriple([encoding, context.backend.symbolByName.Type, context.backend.symbolByName.Composite]))
        throwError(context, encoding, 'Encoding must be a Composite to describe a LLVMType');

    let slotSize = context.backend.getPairOptionally(encoding, context.backend.symbolByName.SlotSize);
    if(slotSize === context.backend.symbolByName.Dynamic)
        throwError(context, encoding, 'LLVM does not support a Dynamic SlotSize');
    else if(slotSize !== context.backend.symbolByName.Void)
        slotSize = context.backend.getData(slotSize);

    const defaultEncoding = context.backend.getPairOptionally(encoding, context.backend.symbolByName.Default),
          defaultDataType = llvmTypeOfEncoding(context, defaultEncoding, slotSize);

    let count = context.backend.getPairOptionally(encoding, context.backend.symbolByName.Count);
    if(count === context.backend.symbolByName.Dynamic)
        throwError(context, encoding, 'LLVM does not support a Dynamic Count');
    else if(count === context.backend.symbolByName.Void)
        return new LLVMPointerType(defaultDataType);
    count = context.backend.getData(count);

    if(defaultEncoding !== context.backend.symbolByName.Void) {
        if(context.backend.getTriple([encoding, context.backend.symbolByName.Type, context.backend.symbolByName.Vector]))
            return new LLVMVectorType(count, defaultDataType);
        else if(count === 1)
            return defaultDataType;
        else
            return new LLVMArrayType(count, defaultDataType);
    }

    const childDataTypes = [];
    for(let i = 0; i < count; ++i) {
        const childEncoding = context.backend.getPairOptionally(encoding, context.backend.symbolInNamespace('Index', i));
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
    switch(context.backend.getPairOptionally(operand, context.backend.symbolByName.Type)) {
        case context.backend.symbolByName.OperatorInstance: {
            if(mode === LLVMValue)
                return;
            const llvmConstant = context.operatorInstanceBySymbol.get(operand).llvmFunction;
            return (mode === LLVMType) ? llvmConstant.type : llvmConstant;
        }
        case context.backend.symbolByName.TypedPlaceholder: {
            const llvmType = llvmTypeOfEncoding(context, context.backend.getPairOptionally(operand, context.backend.symbolByName.PlaceholderEncoding));
            switch(mode) {
                case LLVMType:
                    return llvmType;
                case LLVMValue:
                    return new LLVMValue(llvmType);
                case LLVMConstant:
                    return new LLVMLiteralConstant(llvmType);
            }
        }
        case context.backend.symbolByName.OperandBundle: {
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
            const encoding = context.backend.getPairOptionally(operand, context.backend.symbolByName.Encoding),
                  length = context.backend.getLength(operand);
            if(encoding === context.backend.symbolByName.Void && length === 0)
                return new LLVMCompositeConstant(LLVMSymbolType, [
                    new LLVMLiteralConstant(SymbolInternals.namespaceOfSymbol(operand)),
                    new LLVMLiteralConstant(SymbolInternals.identityOfSymbol(operand))
                ]);
            const dataType = llvmTypeOfEncoding(context, encoding, length);
            return (mode === LLVMType) ? dataType : dataValueToLlvmConstant(dataType, context.backend.getData(operand));
        }
    }
}

function convertToTypedPlaceholder(context, operand) {
    if(context.backend.getTriple([operand, context.backend.symbolByName.Type, context.backend.symbolByName.OperandBundle])) {
        const operands = unbundleOperands(context, operand);
        if(operands.size > 1) {
            let index = 0;
            for(const [operandTag, operand] of operands)
                operands.set(operandTag, convertToTypedPlaceholder(context, operand));
        } else if(operands.size === 1)
            operands.set(operands.keys().next().value, convertToTypedPlaceholder(context, operands.values().next().value));
        return bundleOperands(context, operands);
    }
    const encoding = context.backend.getPairOptionally(operand, context.backend.symbolByName.Encoding),
          size = context.backend.getLength(operand),
          key = encoding+','+size;
    if(context.typedPlaceholderCache.has(key))
        return context.typedPlaceholderCache.get(key);
    const typedPlaceholder = context.backend.createSymbol(context.namespaceId),
          placeholderEncoding = context.backend.createSymbol(context.namespaceId),
          slotSize = context.backend.createSymbol(context.namespaceId);
    throwWarning(context, 'TypedPlaceholder construction is experimental');
    context.backend.setData(slotSize, size);
    context.backend.setTriple([typedPlaceholder, context.backend.symbolByName.Type, context.backend.symbolByName.TypedPlaceholder], true);
    context.backend.setTriple([typedPlaceholder, context.backend.symbolByName.PlaceholderEncoding, placeholderEncoding], true);
    context.backend.setTriple([placeholderEncoding, context.backend.symbolByName.Type, context.backend.symbolByName.Composite], true);
    context.backend.setTriple([placeholderEncoding, context.backend.symbolByName.Count, context.backend.symbolByName.One], true);
    context.backend.setTriple([placeholderEncoding, context.backend.symbolByName.SlotSize, slotSize], true);
    context.backend.setTriple([placeholderEncoding, context.backend.symbolByName.Default, encoding], true);
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
