import { LLVMIntegerType, LLVMPointerType } from './LLVM/Type.js';
import { LLVMValue, LLVMBasicBlock, LLVMFunction } from './LLVM/Value.js';
import { LLVMBranchInstruction, LLVMConditionalBranchInstruction, LLVMBinaryInstruction, LLVMCompareInstruction, LLVMPhiInstruction, LLVMAllocaInstruction, LLVMCastInstruction, LLVMLoadInstruction, LLVMStoreInstruction } from './LLVM/Instruction.js';
import { LLVMVoidConstant, bundleOperands, unbundleOperands, operandsToLlvmValues, llvmTypeAndTypedPlaceholderOfEncoding, getLlvmValue } from './values.js';
import { copyAndRenameOperand, collectDestinations, propagateSources, buildLlvmBundle, unbundleAndMixOperands, buildLlvmCall, buildLLVMFunction, finishExecution, pointerCast } from './utils.js';
import { throwError, throwWarning, popStackFrame } from './stackTrace.js';
import { llvmLookupMaps } from './symbols.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



export function primitiveDeferEvaluation(context, entry) {
    const [outputOperand, outputLlvmValue] = getLlvmValue(context, BasicBackend.symbolByName.Input, entry.inputOperands, entry.aux.inputLlvmValues);
    entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    buildLLVMFunction(context, entry, outputLlvmValue);
    finishExecution(context, entry);
}

export function primitiveBundle(context, entry) {
    entry.outputOperands.set(BasicBackend.symbolByName.Output, entry.inputOperandBundle);
    buildLLVMFunction(context, entry, entry.aux.inputLlvmValueBundle);
    finishExecution(context, entry);
}

export function primitiveUnbundle(context, entry) {
    entry.outputOperands = unbundleOperands(context, entry.inputOperands.get(BasicBackend.symbolByName.Input));
    const outputLlvmValue = entry.aux.inputLlvmValues.get(BasicBackend.symbolByName.Input);
    buildLLVMFunction(context, entry, outputLlvmValue);
    finishExecution(context, entry);
}

export function primitiveStackAllocate(context, entry) {
    const [inputOperand, inputLlvmValue] = getLlvmValue(context, BasicBackend.symbolByName.Input, entry.inputOperands, entry.aux.inputLlvmValues);
    if(!(inputLlvmValue.type instanceof LLVMIntegerType))
        throwError(context, 'Input is not a natural number');
    const llymType = new LLVMIntegerType(32),
          outputOperand = BasicBackend.symbolByName.Pointer,
          memoryOperation = new LLVMAllocaInstruction(new LLVMValue(new LLVMPointerType(new LLVMIntegerType(8))), inputLlvmValue);
          // pointerOperation = new LLVMCastInstruction(new LLVMValue(llymType), 'ptrtoint', memoryOperation.result);
    entry.aux.llvmBasicBlock.instructions.push(memoryOperation);
    // entry.aux.llvmBasicBlock.instructions.push(pointerOperation);
    entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    buildLLVMFunction(context, entry, memoryOperation.result);
    finishExecution(context, entry);
}

export function primitiveLoad(context, entry) {
    const [addressOperand, addressLlvmValue] = getLlvmValue(context, BasicBackend.symbolByName.Address, entry.inputOperands, entry.aux.inputLlvmValues),
          dstPlaceholderEncoding = entry.inputOperands.get(BasicBackend.symbolByName.PlaceholderEncoding),
          dstEncoding = context.ontology.getSolitary(dstPlaceholderEncoding, BasicBackend.symbolByName.Default),
          dstSize = context.ontology.getData(context.ontology.getSolitary(dstPlaceholderEncoding, BasicBackend.symbolByName.SlotSize)),
          [llymType, outputOperand] = llvmTypeAndTypedPlaceholderOfEncoding(context, dstEncoding, dstSize),
          pointerOperation = pointerCast(addressLlvmValue, llymType),
          memoryOperation = new LLVMLoadInstruction(new LLVMValue(llymType), pointerOperation.result);
    entry.aux.llvmBasicBlock.instructions.push(pointerOperation);
    entry.aux.llvmBasicBlock.instructions.push(memoryOperation);
    entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    buildLLVMFunction(context, entry, memoryOperation.result);
    finishExecution(context, entry);
}

export function primitiveStore(context, entry) {
    const [addressOperand, addressLlvmValue] = getLlvmValue(context, BasicBackend.symbolByName.Address, entry.inputOperands, entry.aux.inputLlvmValues),
          [inputOperand, inputLlvmValue] = getLlvmValue(context, BasicBackend.symbolByName.Input, entry.inputOperands, entry.aux.inputLlvmValues),
          pointerOperation = pointerCast(addressLlvmValue, inputLlvmValue.type),
          memoryOperation = new LLVMStoreInstruction(LLVMVoidConstant, inputLlvmValue, pointerOperation.result);
    entry.aux.llvmBasicBlock.instructions.push(pointerOperation);
    entry.aux.llvmBasicBlock.instructions.push(memoryOperation);
    buildLLVMFunction(context, entry);
    finishExecution(context, entry);
}

export function primitiveDivision(context, entry) {
    const inputA = entry.inputOperands.get(BasicBackend.symbolByName.Dividend),
          inputB = entry.inputOperands.get(BasicBackend.symbolByName.Divisor),
          isPlaceholderA = entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.Dividend),
          isPlaceholderB = entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.Divisor);
    let quotientOperand, restOperand;
    if(isPlaceholderA || isPlaceholderB) {
        const inputALlvmValue = getLlvmValue(context, BasicBackend.symbolByName.Dividend, entry.inputOperands, entry.aux.inputLlvmValues)[1],
              inputBLlvmValue = getLlvmValue(context, BasicBackend.symbolByName.Divisor, entry.inputOperands, entry.aux.inputLlvmValues)[1];
        if(inputALlvmValue.type !== inputBLlvmValue.type)
            throwError(context, [inputA, inputB], 'Type mismatch');
        quotientOperand = restOperand = isPlaceholderA ? inputA : inputB;
        const encoding = context.ontology.getSolitary(context.ontology.getSolitary(quotientOperand, BasicBackend.symbolByName.PlaceholderEncoding), BasicBackend.symbolByName.Default),
              prefix = llvmLookupMaps.divisionPrefix.get(encoding),
              divOperation = new LLVMBinaryInstruction(new LLVMValue(inputALlvmValue.type), prefix+'div', inputALlvmValue, inputBLlvmValue),
              remOperation = new LLVMBinaryInstruction(new LLVMValue(inputALlvmValue.type), prefix+'rem', inputALlvmValue, inputBLlvmValue);
        entry.aux.llvmBasicBlock.instructions.push(divOperation);
        entry.aux.llvmBasicBlock.instructions.push(remOperation);
        entry.aux.outputLlvmValues = new Map([
            [BasicBackend.symbolByName.Quotient, divOperation.result],
            [BasicBackend.symbolByName.Rest, remOperation.result]
        ]);
        const returnLlvmValue = buildLlvmBundle(context, entry.aux.llvmBasicBlock, Array.from(entry.aux.outputLlvmValues.values()));
        buildLLVMFunction(context, entry, returnLlvmValue);
    } else {
        const dividend = context.ontology.getData(inputA),
              divisor = context.ontology.getData(inputB);
        quotientOperand = context.ontology.createSymbol(context.namespaceId);
        restOperand = context.ontology.createSymbol(context.namespaceId);
        context.ontology.setData(quotientOperand, dividend/divisor);
        context.ontology.setData(restOperand, dividend%divisor);
    }
    entry.outputOperands.set(BasicBackend.symbolByName.Quotient, quotientOperand);
    entry.outputOperands.set(BasicBackend.symbolByName.Rest, restOperand);
    finishExecution(context, entry);
}

export function primitiveBinaryInstruction(compileCallback, interpretCallback, inputATag, inputBTag, context, entry) {
    let outputOperand, inputAOperand, inputAEncoding, inputBOperand, inputBEncoding;
    if(entry.aux.inputLlvmValues.has(inputATag) || entry.aux.inputLlvmValues.has(inputBTag)) {
        let inputALlvmValue, inputBLlvmValue, operation;
        [inputAOperand, inputALlvmValue] = getLlvmValue(context, inputATag, entry.inputOperands, entry.aux.inputLlvmValues);
        [inputBOperand, inputBLlvmValue] = getLlvmValue(context, inputBTag, entry.inputOperands, entry.aux.inputLlvmValues);
        inputAEncoding = context.ontology.getSolitary(context.ontology.getSolitary(inputAOperand, BasicBackend.symbolByName.PlaceholderEncoding), BasicBackend.symbolByName.Default);
        inputBEncoding = context.ontology.getSolitary(context.ontology.getSolitary(inputBOperand, BasicBackend.symbolByName.PlaceholderEncoding), BasicBackend.symbolByName.Default);
        [outputOperand, operation] = compileCallback(context, entry, inputAOperand, inputAEncoding, inputALlvmValue, inputBLlvmValue);
        entry.aux.llvmBasicBlock.instructions.push(operation);
        buildLLVMFunction(context, entry, operation.result);
    } else {
        inputAOperand = entry.inputOperands.get(inputATag);
        inputBOperand = entry.inputOperands.get(inputBTag);
        inputAEncoding = context.ontology.getSolitary(inputAOperand, BasicBackend.symbolByName.Encoding);
        inputBEncoding = context.ontology.getSolitary(inputBOperand, BasicBackend.symbolByName.Encoding);
        outputOperand = context.ontology.createSymbol(context.namespaceId);
        context.ontology.setData(outputOperand, interpretCallback(context.ontology.getData(inputAOperand), context.ontology.getData(inputBOperand)));
    }
    if(inputAEncoding !== inputBEncoding)
        throwError(context, [inputAOperand, inputBOperand], 'Type mismatch');
    switch(entry.operator) {
        case BasicBackend.symbolByName.MultiplyByPowerOfTwo:
        case BasicBackend.symbolByName.DivideByPowerOfTwo:
            if(inputBEncoding !== BasicBackend.symbolByName.BinaryNumber)
                throwError(context, 'Exponent is not a natural number');
        case BasicBackend.symbolByName.And:
        case BasicBackend.symbolByName.Or:
        case BasicBackend.symbolByName.Xor:
            if(inputAEncoding === BasicBackend.symbolByName.IEEE754)
                throwError(context, 'IEEE754 not supported by bitwise operations');
            break;
    }
    entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    finishExecution(context, entry);
}

export function compileBinaryArithmetic(context, entry, output, encoding, inputALlvmValue, inputBLlvmValue) {
    const prefix = (encoding === BasicBackend.symbolByName.IEEE754) ? 'f' : '';
    return [
        output,
        new LLVMBinaryInstruction(new LLVMValue(inputALlvmValue.type), prefix+llvmLookupMaps.binaryArithmetic.get(entry.operator), inputALlvmValue, inputBLlvmValue)
    ];
}

export function compileBinaryComparison(context, entry, output, encoding, inputALlvmValue, inputBLlvmValue) {
    const prefix = ((encoding === BasicBackend.symbolByName.BinaryNumber || encoding === BasicBackend.symbolByName.TwosComplement) &&
                    (entry.operator === BasicBackend.symbolByName.Equal || entry.operator === BasicBackend.symbolByName.NotEqual))
                    ? '' : llvmLookupMaps.binaryComparisonPrefix.get(encoding);
    return [
        BasicBackend.symbolByName.Boolean,
        new LLVMCompareInstruction(new LLVMValue(new LLVMIntegerType(1)), prefix+llvmLookupMaps.binaryComparison.get(entry.operator), inputALlvmValue, inputBLlvmValue)
    ];
}

export function primitiveIf(context, entry) {
    entry.aux.operatDestinationLlvmValues = {};
    entry.aux.operatDestinationOperands = {};
    entry.aux.operationsBlockedByThis = new Map();
    entry.aux.readyOperations = [BasicBackend.symbolByName.Then, BasicBackend.symbolByName.Else];
    entry.aux.blockedOperations = new Set();
    {
        const destinationOperands = new Map(),
              destinationLlvmValues = new Map();
        for(const operandTag of entry.inputOperands.keys())
            if(operandTag != BasicBackend.symbolByName.Condition && operandTag != BasicBackend.symbolByName.Then && operandTag != BasicBackend.symbolByName.Else)
                copyAndRenameOperand(destinationOperands, destinationLlvmValues, entry, operandTag, operandTag);
        for(const operation of entry.aux.readyOperations) {
            entry.aux.operatDestinationOperands[operation] = new Map(destinationOperands);
            entry.aux.operatDestinationLlvmValues[operation] = new Map(destinationLlvmValues);
            copyAndRenameOperand(entry.aux.operatDestinationOperands[operation], entry.aux.operatDestinationLlvmValues[operation], entry, BasicBackend.symbolByName.Operator, operation);
        }
    }
    if(!entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.Condition)) {
        const operation = context.ontology.getData(entry.inputOperands.get(BasicBackend.symbolByName.Condition)) ? BasicBackend.symbolByName.Then : BasicBackend.symbolByName.Else;
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
                  branchIndex = (operation === BasicBackend.symbolByName.Then) ? 0 : 1,
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
                    throwError(context, [entry.outputOperands.get(BasicBackend.symbolByName.Output), outputOperand], 'Type mismatch');
                continue;
            }
            entry.aux.phiInstruction.result = new LLVMValue(entry.aux.phiInstruction.caseValues[branchIndex].type);
            entry.aux.branchToExit.destinationLabel.instructions = [entry.aux.phiInstruction];
            buildLLVMFunction(context, entry, entry.aux.phiInstruction.result);
            entry.llvmFunction.basicBlocks.splice(0, 0,
                new LLVMBasicBlock(undefined, [new LLVMConditionalBranchInstruction(
                    getLlvmValue(context, BasicBackend.symbolByName.Condition, entry.inputOperands, entry.aux.inputLlvmValues)[1],
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
