import { LLVMIntegerType } from './LLVM/Type.js';
import { LLVMValue, LLVMBasicBlock, LLVMFunction } from './LLVM/Value.js';
import { LLVMReturnInstruction, LLVMBranchInstruction, LLVMConditionalBranchInstruction, LLVMBinaryInstruction, LLVMCompareInstruction, LLVMPhiInstruction } from './LLVM/Instruction.js';
import { bundleOperands, unbundleOperands, operandsToLlvmValues, getLlvmValue } from './values.js';
import { hashOfOperands, copyAndRenameOperand, collectDestinations, propagateSources, buildLlvmBundle, unbundleAndMixOperands, buildLlvmCall, buildLLVMFunction, finishExecution } from './utils.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



function executePrimitiveDeferEvaluation(context, entry) {
    const [outputOperand, outputLlvmValue] = getLlvmValue(context, BasicBackend.symbolByName.Input, entry.inputOperands, entry.aux.inputLlvmValues);
    entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    buildLLVMFunction(context, entry, outputLlvmValue);
    finishExecution(context, entry);
}

function executePrimitiveBundle(context, entry) {
    entry.outputOperands.set(BasicBackend.symbolByName.Output, entry.inputOperandBundle);
    buildLLVMFunction(context, entry, entry.aux.inputLlvmValueBundle);
    finishExecution(context, entry);
}

function executePrimitiveUnbundle(context, entry) {
    entry.outputOperands = unbundleOperands(context, entry.inputOperands.get(BasicBackend.symbolByName.Input));
    const outputLlvmValue = entry.aux.inputLlvmValues.get(BasicBackend.symbolByName.Input);
    buildLLVMFunction(context, entry, outputLlvmValue);
    finishExecution(context, entry);
}

function executePrimitiveMergeBundles(context, entry) {
    // TODO
    const bundleOperandsL = unbundleOperands(context, entry.inputOperands.get(BasicBackend.symbolByName.InputL)),
          bundleOperandsR = unbundleOperands(context, entry.inputOperands.get(BasicBackend.symbolByName.InputR));
          bundleLlvmValuesL = operandsToLlvmValues(context, bundleOperandsL),
          bundleLlvmValuesR = operandsToLlvmValues(context, bundleOperandsR);
    buildLlvmUnbundle(context, entry.aux.llvmBasicBlock, Array.from(bundleLlvmValuesL.values()), entry.aux.inputLlvmValues.get(BasicBackend.symbolByName.InputL));
    buildLlvmUnbundle(context, entry.aux.llvmBasicBlock, Array.from(bundleLlvmValuesR.values()), entry.aux.inputLlvmValues.get(BasicBackend.symbolByName.InputR));

    for(const [operandTag, operand] of bundleOperandsR) {
        if(bundleOperandsL.has(operandTag))
            context.throwError(operandTag, 'OperandTag collision detected');
        bundleOperandsL.set(operandTag, operand);
        const llvmValue = bundleLlvmValuesR.get(operandTag);
        if(llvmValue)
            bundleLlvmValuesL.set(operandTag, llvmValue);
    }

    const bundleOperand = bundleOperands(context, bundleOperandsL.sorted()),
          bundleLlvmValue = buildLlvmBundle(context, entry.aux.llvmBasicBlock, Array.from(bundleLlvmValuesL.sorted().values()));
    entry.outputOperands.set(BasicBackend.symbolByName.Output, bundleOperand);
    buildLLVMFunction(context, entry, bundleLlvmValue);
    finishExecution(context, entry);
}

function executePrimitiveDivision(context, entry) {
    const inputA = entry.inputOperands.get(BasicBackend.symbolByName.Dividend),
          inputB = entry.inputOperands.get(BasicBackend.symbolByName.Divisor),
          isPlaceholderA = entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.Dividend),
          isPlaceholderB = entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.Divisor);
    let quotientOperand, restOperand;
    if(isPlaceholderA || isPlaceholderB) {
        const inputLlvmValueA = getLlvmValue(context, BasicBackend.symbolByName.Dividend, entry.inputOperands, entry.aux.inputLlvmValues)[1],
              inputLlvmValueB = getLlvmValue(context, BasicBackend.symbolByName.Divisor, entry.inputOperands, entry.aux.inputLlvmValues)[1];
        if(inputLlvmValueA.type !== inputLlvmValueB.type)
            context.throwError([inputA, inputB], 'Type mismatch');
        quotientOperand = restOperand = isPlaceholderA ? inputA : inputB;
        const encoding = context.ontology.getSolitary(context.ontology.getSolitary(quotientOperand, BasicBackend.symbolByName.PlaceholderEncoding), BasicBackend.symbolByName.Default),
              prefix = context.llvmLookupMaps.divisionPrefix.get(encoding),
              divOperation = new LLVMBinaryInstruction(new LLVMValue(inputLlvmValueA.type), prefix+'div', inputLlvmValueA, inputLlvmValueB),
              remOperation = new LLVMBinaryInstruction(new LLVMValue(inputLlvmValueA.type), prefix+'rem', inputLlvmValueA, inputLlvmValueB);
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
        quotientOperand = context.ontology.createSymbol(context.executionNamespaceId);
        restOperand = context.ontology.createSymbol(context.executionNamespaceId);
        context.ontology.setData(quotientOperand, dividend/divisor);
        context.ontology.setData(restOperand, dividend%divisor);
    }
    entry.outputOperands.set(BasicBackend.symbolByName.Quotient, quotientOperand);
    entry.outputOperands.set(BasicBackend.symbolByName.Rest, restOperand);
    finishExecution(context, entry);
}

function executePrimitiveBinaryInstruction(compileCallback, interpretCallback, inputTagA, inputTagB, context, entry) {
    const inputA = entry.inputOperands.get(inputTagA),
          inputB = entry.inputOperands.get(inputTagB),
          isPlaceholderA = entry.aux.inputLlvmValues.has(inputTagA),
          isPlaceholderB = entry.aux.inputLlvmValues.has(inputTagB);
    let outputOperand;
    if(isPlaceholderA || isPlaceholderB) {
        const inputLlvmValueA = getLlvmValue(context, inputTagA, entry.inputOperands, entry.aux.inputLlvmValues)[1],
              inputLlvmValueB = getLlvmValue(context, inputTagB, entry.inputOperands, entry.aux.inputLlvmValues)[1];
        if(inputLlvmValueA.type !== inputLlvmValueB.type)
            context.throwError([inputA, inputB], 'Type mismatch');
        let operation;
        const output = isPlaceholderA ? inputA : inputB,
              encoding = context.ontology.getSolitary(context.ontology.getSolitary(output, BasicBackend.symbolByName.PlaceholderEncoding), BasicBackend.symbolByName.Default);
        [outputOperand, operation] = compileCallback(context, entry, output, encoding, inputLlvmValueA, inputLlvmValueB);
        entry.aux.llvmBasicBlock.instructions.push(operation);
        buildLLVMFunction(context, entry, operation.result);
    } else {
        const output = interpretCallback(context.ontology.getData(inputA), context.ontology.getData(inputB));
        outputOperand = context.ontology.createSymbol(context.executionNamespaceId);
        context.ontology.setData(outputOperand, output);
    }
    entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    finishExecution(context, entry);
}

function compileBinaryArithmetic(context, entry, output, encoding, inputLlvmValueA, inputLlvmValueB) {
    const prefix = (encoding == BasicBackend.symbolByName.IEEE754) ? 'f' : '';
    return [
        output,
        new LLVMBinaryInstruction(new LLVMValue(inputLlvmValueA.type), prefix+context.llvmLookupMaps.binaryArithmetic.get(entry.operator), inputLlvmValueA, inputLlvmValueB)
    ];
}

function compileBinaryBitwise(context, entry, output, encoding, inputLlvmValueA, inputLlvmValueB) {
    if(encoding == BasicBackend.symbolByName.IEEE754)
        context.throwError('IEEE754 not supported by bitwise operations');
    return [
        output,
        new LLVMBinaryInstruction(new LLVMValue(inputLlvmValueA.type), context.llvmLookupMaps.binaryBitwise.get(entry.operator), inputLlvmValueA, inputLlvmValueB)
    ];
}

function compileBinaryComparison(context, entry, output, encoding, inputLlvmValueA, inputLlvmValueB) {
    const prefix = ((encoding === BasicBackend.symbolByName.BinaryNumber || encoding === BasicBackend.symbolByName.TwosComplement) &&
                    (entry.operator === BasicBackend.symbolByName.Equal || entry.operator === BasicBackend.symbolByName.NotEqual))
                    ? '' : context.llvmLookupMaps.binaryComparisonPrefix.get(encoding);
    return [
        BasicBackend.symbolByName.Boolean,
        new LLVMCompareInstruction(new LLVMValue(new LLVMIntegerType(1)), prefix+context.llvmLookupMaps.binaryComparison.get(entry.operator), inputLlvmValueA, inputLlvmValueB)
    ];
}

function executePrimitiveIf(context, entry) {
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
                  branchIndex = (operation == BasicBackend.symbolByName.Then) ? 0 : 1,
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
                    context.throwError([entry.outputOperands.get(BasicBackend.symbolByName.Output), outputOperand], 'Type mismatch');
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
            context.popStackFrame(entry, 'Blocked');
            return;
        }
        finishExecution(context, entry);
    };
    entry.aux.resume();
}

function executeCustomOperator(context, entry) {
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
            context.popStackFrame(entry, 'Blocked');
            return;
        }
        if(entry.aux.unsatisfiedOperations.size > 0)
            context.throwError(entry.symbol, 'Topological sort failed: Operations are not a DAG');
        unbundleAndMixOperands(context, entry, 'output');
        if(entry.aux.llvmBasicBlock.instructions.length > 0 || entry.aux.outputLlvmValues.size > 0) {
            const returnLlvmValue = buildLlvmBundle(context, entry.aux.llvmBasicBlock, Array.from(entry.aux.outputLlvmValues.values()));
            buildLLVMFunction(context, entry, returnLlvmValue, false);
        }
        finishExecution(context, entry);
    };
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.MMV, [entry.operator, BasicBackend.symbolByName.Operation, BasicBackend.symbolByName.Void]))
        collectDestinations(context, entry, triple[2]);
    collectDestinations(context, entry, entry.operator);
    propagateSources(context, entry, entry.operator, entry.inputOperands, entry.aux.inputLlvmValues, entry.inputOperandBundle, entry.aux.inputLlvmValueBundle);
    entry.aux.resume();
}

export function execute(context, inputOperands) {
    const entry = {'inputOperands': inputOperands};
    entry.operator = entry.inputOperands.get(BasicBackend.symbolByName.Operator);
    entry.inputOperands = entry.inputOperands.sorted();
    entry.hash = hashOfOperands(context, entry.inputOperands);
    if(context.operatorInstanceByHash.has(entry.hash))
        return context.operatorInstanceByHash.get(entry.hash);
    entry.symbol = context.ontology.createSymbol(context.executionNamespaceId);
    context.pushStackFrame(entry, 'Begin');
    entry.outputOperands = new Map();
    entry.aux = {
        'llvmBasicBlock': new LLVMBasicBlock(),
        'inputLlvmValues': operandsToLlvmValues(context, entry.inputOperands)
    };
    entry.aux.llvmFunctionParameters = Array.from(entry.aux.inputLlvmValues.values());
    unbundleAndMixOperands(context, entry, 'input');
    entry.inputOperands.delete(BasicBackend.symbolByName.Operator);
    entry.inputOperandBundle = bundleOperands(context, entry.inputOperands);
    entry.aux.inputLlvmValueBundle = buildLlvmBundle(context, entry.aux.llvmBasicBlock, Array.from(entry.aux.inputLlvmValues.values()));
    context.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.OperatorInstance], true);
    context.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.Operator, entry.operator], true);
    context.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.InputOperands, entry.inputOperandBundle], true);
    context.operatorInstanceBySymbol.set(entry.symbol, entry);
    context.operatorInstanceByHash.set(entry.hash, entry);
    if(!entry.operator || entry.operator == BasicBackend.symbolByName.Void)
        context.throwError(entry.symbol, 'Tried calling Void as Operator');
    const primitives = new Map([
        [BasicBackend.symbolByName.DeferEvaluation, executePrimitiveDeferEvaluation],
        [BasicBackend.symbolByName.Bundle, executePrimitiveBundle],
        [BasicBackend.symbolByName.Unbundle, executePrimitiveUnbundle],
        [BasicBackend.symbolByName.MergeBundles, executePrimitiveMergeBundles],
        [BasicBackend.symbolByName.Division, executePrimitiveDivision],
        [BasicBackend.symbolByName.Addition, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a+b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Subtraction, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a-b), BasicBackend.symbolByName.Minuend, BasicBackend.symbolByName.Subtrahend)],
        [BasicBackend.symbolByName.Multiplication, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a*b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.And, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryBitwise, (a, b) => (a&b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Or, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryBitwise, (a, b) => (a|b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Xor, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryBitwise, (a, b) => (a^b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Equal, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a==b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.NotEqual, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a!=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.LessThan, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.LessEqual, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.GreaterThan, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.GreaterEqual, executePrimitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.If, executePrimitiveIf],
    ]);
    const primitive = primitives.get(entry.operator);
    ((primitive) ? primitive : executeCustomOperator)(context, entry);
    return entry;
}
