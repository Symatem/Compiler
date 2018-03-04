import { LLVMType, LLVMIntegerType, LLVMFloatType, LLVMPointerType, LLVMCompositeType, LLVMVectorType, LLVMArrayType, LLVMStructureType } from './LLVM/Type.js';
import { LLVMValue, LLVMLiteralConstant, LLVMTextConstant, LLVMCompositeConstant } from './LLVM/Value.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export const LLVMSymbolType = new LLVMStructureType([new LLVMIntegerType(32), new LLVMIntegerType(32)]),
             LLVMVoidConstant = new LLVMLiteralConstant(new LLVMType('void'));

export function encodingToLlvmType(context, encoding, length) {
    // TODO: LLVMFunctionType
    if(Number.isInteger(length) && length >= 0)
        switch(encoding) {
            case BasicBackend.symbolByName.Void:
                return new LLVMType('void');
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

export function constantToLlvmConstant(context, symbol) {
    if(context.operatorInstanceBySymbol.has(symbol))
        return context.operatorInstanceBySymbol.get(symbol).llvmFunction;
    const encoding = context.ontology.getSolitary(symbol, BasicBackend.symbolByName.Encoding),
          length = context.ontology.getLength(symbol);
    if(encoding === BasicBackend.symbolByName.Void && length === 0)
        return new LLVMCompositeConstant(LLVMSymbolType, [new LLVMLiteralConstant(BasicBackend.namespaceOfSymbol(symbol)), new LLVMLiteralConstant(BasicBackend.identityOfSymbol(symbol))]);
    const dataType = encodingToLlvmType(context, encoding, length),
          dataValue = context.ontology.getData(symbol);
    return dataValueToLlvmConstant(dataType, dataValue);
}
