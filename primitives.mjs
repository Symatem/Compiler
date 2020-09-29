import { LLVMIntegerType, LLVMPointerType } from './LLVM/Type.mjs';
import { LLVMValue, LLVMBasicBlock } from './LLVM/Value.mjs';
import { LLVMBranchInstruction, LLVMConditionalBranchInstruction, LLVMBinaryInstruction, LLVMCompareInstruction, LLVMPhiInstruction, LLVMAllocaInstruction, LLVMCastInstruction, LLVMLoadInstruction, LLVMStoreInstruction } from './LLVM/Instruction.mjs';
import { LLVMVoidConstant, unbundleOperands, llvmTypeAndTypedPlaceholderOfEncoding, getLlvmValue } from './values.mjs';
import { copyAndRenameOperand, buildLlvmBundle, buildLlvmCall, buildLLVMFunction, finishExecution, pointerCast } from './utils.mjs';
import { throwError, popStackFrame } from './stackTrace.mjs';
import { llvmLookupMaps } from './symbols.mjs';



export function primitiveDeferEvaluation(context, entry) {
    const [outputOperand, outputLlvmValue] = getLlvmValue(context, context.backend.symbolByName.Input, entry.inputOperands, entry.aux.inputLlvmValues);
    entry.outputOperands.set(context.backend.symbolByName.Output, outputOperand);
    buildLLVMFunction(context, entry, outputLlvmValue);
    finishExecution(context, entry);
}

export function primitiveBundle(context, entry) {
    entry.outputOperands.set(context.backend.symbolByName.Output, entry.inputOperandBundle);
    buildLLVMFunction(context, entry, entry.aux.inputLlvmValueBundle);
    finishExecution(context, entry);
}

export function primitiveUnbundle(context, entry) {
    entry.outputOperands = unbundleOperands(context, entry.inputOperands.get(context.backend.symbolByName.Input));
    const outputLlvmValue = entry.aux.inputLlvmValues.get(context.backend.symbolByName.Input);
    buildLLVMFunction(context, entry, outputLlvmValue);
    finishExecution(context, entry);
}

export function primitiveStackAllocate(context, entry) {
    const [inputOperand, inputLlvmValue] = getLlvmValue(context, context.backend.symbolByName.Input, entry.inputOperands, entry.aux.inputLlvmValues);
    if(!(inputLlvmValue.type instanceof LLVMIntegerType))
        throwError(context, 'Input is not a natural number');
    const llymType = new LLVMIntegerType(32),
          outputOperand = context.backend.symbolByName.Pointer,
          memoryOperation = new LLVMAllocaInstruction(new LLVMValue(new LLVMPointerType(new LLVMIntegerType(8))), inputLlvmValue);
          // pointerOperation = new LLVMCastInstruction(new LLVMValue(llymType), 'ptrtoint', memoryOperation.result);
    entry.aux.llvmBasicBlock.instructions.push(memoryOperation);
    // entry.aux.llvmBasicBlock.instructions.push(pointerOperation);
    entry.outputOperands.set(context.backend.symbolByName.Output, outputOperand);
    buildLLVMFunction(context, entry, memoryOperation.result);
    finishExecution(context, entry);
}

export function primitiveLoad(context, entry) {
    const [addressOperand, addressLlvmValue] = getLlvmValue(context, context.backend.symbolByName.Address, entry.inputOperands, entry.aux.inputLlvmValues),
          dstPlaceholderEncoding = entry.inputOperands.get(context.backend.symbolByName.PlaceholderEncoding),
          dstEncoding = context.backend.getPairOptionally(dstPlaceholderEncoding, context.backend.symbolByName.Default),
          dstSize = context.backend.getData(context.backend.getPairOptionally(dstPlaceholderEncoding, context.backend.symbolByName.SlotSize)),
          [llymType, outputOperand] = llvmTypeAndTypedPlaceholderOfEncoding(context, dstEncoding, dstSize),
          pointerOperation = pointerCast(addressLlvmValue, llymType),
          memoryOperation = new LLVMLoadInstruction(new LLVMValue(llymType), pointerOperation.result);
    entry.aux.llvmBasicBlock.instructions.push(pointerOperation);
    entry.aux.llvmBasicBlock.instructions.push(memoryOperation);
    entry.outputOperands.set(context.backend.symbolByName.Output, outputOperand);
    buildLLVMFunction(context, entry, memoryOperation.result);
    finishExecution(context, entry);
}

export function primitiveStore(context, entry) {
    const [addressOperand, addressLlvmValue] = getLlvmValue(context, context.backend.symbolByName.Address, entry.inputOperands, entry.aux.inputLlvmValues),
          [inputOperand, inputLlvmValue] = getLlvmValue(context, context.backend.symbolByName.Input, entry.inputOperands, entry.aux.inputLlvmValues),
          pointerOperation = pointerCast(addressLlvmValue, inputLlvmValue.type),
          memoryOperation = new LLVMStoreInstruction(LLVMVoidConstant, inputLlvmValue, pointerOperation.result);
    entry.aux.llvmBasicBlock.instructions.push(pointerOperation);
    entry.aux.llvmBasicBlock.instructions.push(memoryOperation);
    buildLLVMFunction(context, entry);
    finishExecution(context, entry);
}

export function primitiveConversion(numeric, context, entry) {
    const inputOperand = entry.inputOperands.get(context.backend.symbolByName.Input),
          dstPlaceholderEncoding = entry.inputOperands.get(context.backend.symbolByName.PlaceholderEncoding),
          dstEncoding = context.backend.getPairOptionally(dstPlaceholderEncoding, context.backend.symbolByName.Default),
          dstSize = context.backend.getData(context.backend.getPairOptionally(dstPlaceholderEncoding, context.backend.symbolByName.SlotSize)),
          inputLlvmValue = entry.aux.inputLlvmValues.get(context.backend.symbolByName.Input);
    let outputOperand = inputOperand, srcEncoding, srcSize;
    if(inputLlvmValue) {
        const srcPlaceholderEncoding = context.backend.getPairOptionally(inputOperand, context.backend.symbolByName.PlaceholderEncoding);
        srcEncoding = context.backend.getPairOptionally(srcPlaceholderEncoding, context.backend.symbolByName.Default);
        srcSize = context.backend.getData(context.backend.getPairOptionally(srcPlaceholderEncoding, context.backend.symbolByName.SlotSize));
    } else {
        srcEncoding = context.backend.getPairOptionally(inputOperand, context.backend.symbolByName.Encoding);
        srcSize = context.backend.getLength(inputOperand);
    }
    if(!numeric && srcSize != dstSize)
        throwError(context, 'PlaceholderEncoding SlotSize mismatch');
    if(srcEncoding != dstEncoding || srcSize != dstSize) {
        if(inputLlvmValue) {
            let llymType, kind = 'bitcast';
            [llymType, outputOperand] = llvmTypeAndTypedPlaceholderOfEncoding(context, dstEncoding, dstSize);
            if(numeric) {
                if(srcEncoding === context.backend.symbolByName.IEEE754) {
                    kind = (dstEncoding === context.backend.symbolByName.IEEE754)
                        ? ((srcSize > dstSize) ? 'fptrunc' : 'fpext')
                        : ((dstEncoding === context.backend.symbolByName.BinaryNumber) ? 'fptoui' : 'fptosi');
                } else {
                    if(dstEncoding === context.backend.symbolByName.IEEE754)
                        kind = (srcEncoding === context.backend.symbolByName.BinaryNumber) ? 'uitofp' : 'sitofp';
                    else if(srcSize > dstSize)
                        kind = 'trunc';
                    else
                        kind = (srcEncoding === context.backend.symbolByName.BinaryNumber) ? 'zext' : 'sext';
                }
            }
            const operation = new LLVMCastInstruction(new LLVMValue(llymType), kind, inputLlvmValue);
            entry.aux.llvmBasicBlock.instructions.push(operation);
            buildLLVMFunction(context, entry, operation.result);
        } else {
            outputOperand = context.backend.createSymbol(context.namespaceId);
            const dataBytes = (numeric)
                ? context.backend.encodeBinary(dstEncoding, context.backend.getData(inputOperand))
                : context.backend.getRawData(inputOperand);
            context.backend.getAndSetPairs(outputOperand, symbolByName.Encoding, [dstEncoding]);
            context.backend.setRawData(outputOperand, dataBytes, dstSize);
        }
    } else if(inputLlvmValue)
        buildLLVMFunction(context, entry, inputLlvmValue);
    entry.outputOperands.set(context.backend.symbolByName.Output, outputOperand);
    finishExecution(context, entry);
}

export function primitiveDivision(context, entry) {
    const inputA = entry.inputOperands.get(context.backend.symbolByName.Dividend),
          inputB = entry.inputOperands.get(context.backend.symbolByName.Divisor),
          isPlaceholderA = entry.aux.inputLlvmValues.has(context.backend.symbolByName.Dividend),
          isPlaceholderB = entry.aux.inputLlvmValues.has(context.backend.symbolByName.Divisor);
    let quotientOperand, restOperand;
    if(isPlaceholderA || isPlaceholderB) {
        const inputALlvmValue = getLlvmValue(context, context.backend.symbolByName.Dividend, entry.inputOperands, entry.aux.inputLlvmValues)[1],
              inputBLlvmValue = getLlvmValue(context, context.backend.symbolByName.Divisor, entry.inputOperands, entry.aux.inputLlvmValues)[1];
        if(inputALlvmValue.type !== inputBLlvmValue.type)
            throwError(context, [inputA, inputB], 'Type mismatch');
        quotientOperand = restOperand = isPlaceholderA ? inputA : inputB;
        const encoding = context.backend.getPairOptionally(context.backend.getPairOptionally(quotientOperand, context.backend.symbolByName.PlaceholderEncoding), context.backend.symbolByName.Default),
              prefix = llvmLookupMaps.divisionPrefix.get(encoding),
              divOperation = new LLVMBinaryInstruction(new LLVMValue(inputALlvmValue.type), prefix+'div', inputALlvmValue, inputBLlvmValue),
              remOperation = new LLVMBinaryInstruction(new LLVMValue(inputALlvmValue.type), prefix+'rem', inputALlvmValue, inputBLlvmValue);
        entry.aux.llvmBasicBlock.instructions.push(divOperation);
        entry.aux.llvmBasicBlock.instructions.push(remOperation);
        entry.aux.outputLlvmValues = new Map([
            [context.backend.symbolByName.Quotient, divOperation.result],
            [context.backend.symbolByName.Rest, remOperation.result]
        ]);
        const returnLlvmValue = buildLlvmBundle(context, entry.aux.llvmBasicBlock, Array.from(entry.aux.outputLlvmValues.values()));
        buildLLVMFunction(context, entry, returnLlvmValue);
    } else {
        const dividend = context.backend.getData(inputA),
              divisor = context.backend.getData(inputB);
        quotientOperand = context.backend.createSymbol(context.namespaceId);
        restOperand = context.backend.createSymbol(context.namespaceId);
        context.backend.setData(quotientOperand, dividend/divisor);
        context.backend.setData(restOperand, dividend%divisor);
    }
    entry.outputOperands.set(context.backend.symbolByName.Quotient, quotientOperand);
    entry.outputOperands.set(context.backend.symbolByName.Rest, restOperand);
    finishExecution(context, entry);
}

export function primitiveBinaryInstruction(compileCallback, interpretCallback, inputATag, inputBTag, context, entry) {
    let outputOperand, inputAOperand, inputAEncoding, inputBOperand, inputBEncoding;
    if(entry.aux.inputLlvmValues.has(inputATag) || entry.aux.inputLlvmValues.has(inputBTag)) {
        let inputALlvmValue, inputBLlvmValue, operation;
        [inputAOperand, inputALlvmValue] = getLlvmValue(context, inputATag, entry.inputOperands, entry.aux.inputLlvmValues);
        [inputBOperand, inputBLlvmValue] = getLlvmValue(context, inputBTag, entry.inputOperands, entry.aux.inputLlvmValues);
        inputAEncoding = context.backend.getPairOptionally(context.backend.getPairOptionally(inputAOperand, context.backend.symbolByName.PlaceholderEncoding), context.backend.symbolByName.Default);
        inputBEncoding = context.backend.getPairOptionally(context.backend.getPairOptionally(inputBOperand, context.backend.symbolByName.PlaceholderEncoding), context.backend.symbolByName.Default);
        [outputOperand, operation] = compileCallback(context, entry, inputAOperand, inputAEncoding, inputALlvmValue, inputBLlvmValue);
        entry.aux.llvmBasicBlock.instructions.push(operation);
        buildLLVMFunction(context, entry, operation.result);
    } else {
        inputAOperand = entry.inputOperands.get(inputATag);
        inputBOperand = entry.inputOperands.get(inputBTag);
        inputAEncoding = context.backend.getPairOptionally(inputAOperand, context.backend.symbolByName.Encoding);
        inputBEncoding = context.backend.getPairOptionally(inputBOperand, context.backend.symbolByName.Encoding);
        outputOperand = context.backend.createSymbol(context.namespaceId);
        context.backend.setData(outputOperand, interpretCallback(context.backend.getData(inputAOperand), context.backend.getData(inputBOperand)));
    }
    if(entry.operator === context.backend.symbolByName.MultiplyByPowerOfTwo ||
       entry.operator === context.backend.symbolByName.DivideByPowerOfTwo) {
        if(inputBEncoding !== context.backend.symbolByName.BinaryNumber)
            throwError(context, inputBOperand, 'Exponent is not a natural number');
    } else if(inputAEncoding !== inputBEncoding)
        throwError(context, [inputAOperand, inputBOperand], 'Type mismatch');
    switch(entry.operator) {
        case context.backend.symbolByName.MultiplyByPowerOfTwo:
        case context.backend.symbolByName.DivideByPowerOfTwo:
        case context.backend.symbolByName.And:
        case context.backend.symbolByName.Or:
        case context.backend.symbolByName.Xor:
            if(inputAEncoding === context.backend.symbolByName.IEEE754)
                throwError(context, inputAOperand, 'IEEE754 not supported by bitwise operations');
            break;
    }
    entry.outputOperands.set(context.backend.symbolByName.Output, outputOperand);
    finishExecution(context, entry);
}

export function compileBitShift(context, entry, output, encoding, inputALlvmValue, inputBLlvmValue) {
    const kind = (entry.operator === context.backend.symbolByName.MultiplyByPowerOfTwo)
        ? 'shl'
        : ((encoding === context.backend.symbolByName.BinaryNumber) ? 'lshr': 'ashr');
    return [
        output,
        new LLVMBinaryInstruction(new LLVMValue(inputALlvmValue.type), kind, inputALlvmValue, inputBLlvmValue)
    ];
}

export function compileBinaryArithmetic(context, entry, output, encoding, inputALlvmValue, inputBLlvmValue) {
    const prefix = (encoding === context.backend.symbolByName.IEEE754) ? 'f' : '';
    return [
        output,
        new LLVMBinaryInstruction(new LLVMValue(inputALlvmValue.type), prefix+llvmLookupMaps.binaryArithmetic.get(entry.operator), inputALlvmValue, inputBLlvmValue)
    ];
}

export function compileBinaryComparison(context, entry, output, encoding, inputALlvmValue, inputBLlvmValue) {
    const prefix = ((encoding === context.backend.symbolByName.BinaryNumber || encoding === context.backend.symbolByName.TwosComplement) &&
                    (entry.operator === context.backend.symbolByName.Equal || entry.operator === context.backend.symbolByName.NotEqual))
                    ? '' : llvmLookupMaps.binaryComparisonPrefix.get(encoding);
    return [
        context.backend.symbolByName.Boolean,
        new LLVMCompareInstruction(new LLVMValue(new LLVMIntegerType(1)), prefix+llvmLookupMaps.binaryComparison.get(entry.operator), inputALlvmValue, inputBLlvmValue)
    ];
}

export function primitiveIf(context, entry) {
    entry.aux.operatDestinationLlvmValues = {};
    entry.aux.operatDestinationOperands = {};
    entry.aux.operationsBlockedByThis = new Map();
    entry.aux.readyOperations = [context.backend.symbolByName.Then, context.backend.symbolByName.Else];
    entry.aux.blockedOperations = new Set();
    {
        const destinationOperands = new Map(),
              destinationLlvmValues = new Map();
        for(const operandTag of entry.inputOperands.keys())
            if(operandTag != context.backend.symbolByName.Condition && operandTag != context.backend.symbolByName.Then && operandTag != context.backend.symbolByName.Else)
                copyAndRenameOperand(destinationOperands, destinationLlvmValues, entry, operandTag, operandTag);
        for(const operation of entry.aux.readyOperations) {
            entry.aux.operatDestinationOperands[operation] = new Map(destinationOperands);
            entry.aux.operatDestinationLlvmValues[operation] = new Map(destinationLlvmValues);
            copyAndRenameOperand(entry.aux.operatDestinationOperands[operation], entry.aux.operatDestinationLlvmValues[operation], entry, context.backend.symbolByName.Operator, operation);
        }
    }
    if(!entry.aux.inputLlvmValues.has(context.backend.symbolByName.Condition)) {
        const operation = context.backend.getData(entry.inputOperands.get(context.backend.symbolByName.Condition)) ? context.backend.symbolByName.Then : context.backend.symbolByName.Else;
        entry.aux.resume = function() {
            const [instanceEntry, sourceLlvmValues, sourceLlvmValueBundle] = buildLlvmCall(
                context, entry.aux.llvmBasicBlock, entry, operation,
                entry.aux.operatDestinationOperands[operation],
                entry.aux.operatDestinationLlvmValues[operation]
            );
            if(!sourceLlvmValues)
                return;
            entry.outputOperands = instanceEntry.outputOperands;
            if(instanceEntry.llvmFunction)
                buildLLVMFunction(context, entry, sourceLlvmValueBundle);
            finishExecution(context, entry);
        };
        entry.aux.resume();
        return;
    }
    entry.aux.branchToExit = new LLVMBranchInstruction(entry.aux.llvmBasicBlock);
    entry.aux.phiInstruction = new LLVMPhiInstruction(undefined, [], [new LLVMBasicBlock(), new LLVMBasicBlock()]);
    entry.aux.resume = function() {
        while(entry.aux.readyOperations.length > 0) {
            const operation = entry.aux.readyOperations.shift(),
                  branchIndex = (operation === context.backend.symbolByName.Then) ? 0 : 1,
                  label = entry.aux.phiInstruction.caseLabels[branchIndex],
                  [instanceEntry, sourceLlvmValues, sourceLlvmValueBundle] = buildLlvmCall(
                context, label, entry, operation,
                entry.aux.operatDestinationOperands[operation],
                entry.aux.operatDestinationLlvmValues[operation]
            );
            if(!sourceLlvmValues)
                continue;
            if(label.instructions.length > 0)
                label.instructions[0].attributes.push('alwaysinline');
            for(const operandTag of instanceEntry.outputOperands.keys()) {
                const [outputOperand, outputLlvmValue] = getLlvmValue(context, operandTag, instanceEntry.outputOperands, sourceLlvmValues);
                entry.outputOperands.set(operandTag, outputOperand);
                sourceLlvmValues.set(operandTag, outputLlvmValue);
            }
            entry.aux.phiInstruction.caseValues[branchIndex] = buildLlvmBundle(context, label, Array.from(sourceLlvmValues.values()));
            label.instructions.push(entry.aux.branchToExit);
            if(entry.aux.ready) {
                if(entry.aux.phiInstruction.caseValues[0].type !== entry.aux.phiInstruction.caseValues[1].type)
                    throwError(context, [entry.outputOperands.get(context.backend.symbolByName.Output), outputOperand], 'Type mismatch');
                continue;
            }
            entry.aux.phiInstruction.result = new LLVMValue(entry.aux.phiInstruction.caseValues[branchIndex].type);
            entry.aux.branchToExit.destinationLabel.instructions = [entry.aux.phiInstruction];
            buildLLVMFunction(context, entry, entry.aux.phiInstruction.result);
            entry.llvmFunction.basicBlocks.splice(0, 0,
                new LLVMBasicBlock(undefined, [new LLVMConditionalBranchInstruction(
                    getLlvmValue(context, context.backend.symbolByName.Condition, entry.inputOperands, entry.aux.inputLlvmValues)[1],
                    entry.aux.phiInstruction.caseLabels[0],
                    entry.aux.phiInstruction.caseLabels[1]
                )]),
                entry.aux.phiInstruction.caseLabels[0],
                entry.aux.phiInstruction.caseLabels[1]
            );
            entry.aux.ready = true;
        }
        if(entry.aux.blockedOperations.size > 0) {
            popStackFrame(context, entry, 'Blocked');
            return;
        }
        finishExecution(context, entry);
    };
    entry.aux.resume();
}
