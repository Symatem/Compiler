import { LLVMIntegerType } from './LLVM/Type.js';
import { LLVMValue, LLVMBasicBlock, LLVMFunction } from './LLVM/Value.js';
import { LLVMReturnInstruction, LLVMBranchInstruction, LLVMConditionalBranchInstruction, LLVMBinaryInstruction, LLVMCompareInstruction, LLVMPhiInstruction } from './LLVM/Instruction.js';
import { bundleOperands, unbundleOperands, operandsToLlvmValues, getLlvmValue } from './values.js';
import { hashOfOperands, renamedOperands, collectDestinations, propagateSources, buildLlvmBundle, unbundleAndMixOperands, buildLlvmCall, buildLLVMFunction, finishExecution } from './utils.js';
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
            context.throwError('OperandTag collision detected');
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

function executePrimitiveBinaryInstruction(context, entry, compileCallback, interpretCallback) {
    const inputL = entry.inputOperands.get(BasicBackend.symbolByName.InputL),
          inputR = entry.inputOperands.get(BasicBackend.symbolByName.InputR);
    const isPlaceholderL = entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.InputL),
          isPlaceholderR = entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.InputR);
    if(isPlaceholderL || isPlaceholderR) {
        const inputLlvmValueL = getLlvmValue(context, BasicBackend.symbolByName.InputL, entry.inputOperands, entry.aux.inputLlvmValues)[1],
              inputLlvmValueR = getLlvmValue(context, BasicBackend.symbolByName.InputR, entry.inputOperands, entry.aux.inputLlvmValues)[1];
        if(inputLlvmValueL.type !== inputLlvmValueR.type)
            context.throwError('InputL and InputR type mismatch');
        const [outputOperand, operation] = compileCallback(isPlaceholderL ? inputL : inputR, inputLlvmValueL, inputLlvmValueR);
        entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
        entry.aux.llvmBasicBlock.instructions.push(operation);
        buildLLVMFunction(context, entry, operation.result);
    } else {
        const output = interpretCallback(context.ontology.getData(inputL), context.ontology.getData(inputR)),
              outputOperand = context.ontology.createSymbol(context.executionNamespaceId);
        context.ontology.setData(outputOperand, output);
        entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    }
    finishExecution(context, entry);
}

function executePrimitiveIf(context, entry) {
    entry.aux.operatDestinationLlvmValues = [];
    entry.aux.operatDestinationOperands = [];
    entry.aux.operationsBlockedByThis = new Map();
    entry.aux.readyOperations = [0, 1];
    entry.aux.blockedOperations = new Set();
    for(const operation of entry.aux.readyOperations) {
        const branch = (operation) ? 'Else' : 'Then';
        entry.aux.operatDestinationOperands[operation] = new Map();
        entry.aux.operatDestinationLlvmValues[operation] = new Map();
        renamedOperands(entry.aux.operatDestinationOperands[operation], entry.aux.operatDestinationLlvmValues[operation], entry, [
            [BasicBackend.symbolByName.Operator, BasicBackend.symbolByName[branch]],
            [BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Input]
        ]);
    }
    if(!entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.Condition)) {
        const operation = context.ontology.getData(entry.inputOperands.get(BasicBackend.symbolByName.Condition)) ? 0 : 1;
        entry.aux.resume = function() {
            const [instanceEntry, sourceLlvmValues, sourceLlvmValueBundle] = buildLlvmCall(
                context, entry.aux.llvmBasicBlock, entry, operation,
                entry.aux.operatDestinationOperands[operation],
                entry.aux.operatDestinationLlvmValues[operation]
            );
            if(!sourceLlvmValues)
                return;
            const outputOperand = instanceEntry.outputOperands.get(BasicBackend.symbolByName.Output),
                  outputLlvmValue = sourceLlvmValues.get(BasicBackend.symbolByName.Output);
            entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
            if(instanceEntry.llvmFunction)
                buildLLVMFunction(context, entry, outputLlvmValue);
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
                  label = entry.aux.phiInstruction.caseLabels[operation],
                  [instanceEntry, sourceLlvmValues, sourceLlvmValueBundle] = buildLlvmCall(
                context, label, entry, operation,
                entry.aux.operatDestinationOperands[operation],
                entry.aux.operatDestinationLlvmValues[operation]
            );
            if(!sourceLlvmValues)
                continue;
            if(label.instructions.length > 0)
                label.instructions[0].attributes.push('alwaysinline');
            label.instructions.push(entry.aux.branchToExit);
            const [outputOperand, outputLlvmValue] = getLlvmValue(context, BasicBackend.symbolByName.Output, instanceEntry.outputOperands, sourceLlvmValues);
            entry.aux.phiInstruction.caseValues[operation] = outputLlvmValue;
            if(entry.aux.ready) {
                if(entry.aux.phiInstruction.caseValues[0].type !== entry.aux.phiInstruction.caseValues[1].type)
                    context.throwError('Then Output and Else Output type mismatch');
                continue;
            }
            entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
            entry.aux.phiInstruction.result = new LLVMValue(outputLlvmValue.type);
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
            const operation = entry.aux.readyOperations.shift();
            context.log('Operation '+operation);
            const [instanceEntry, sourceLlvmValues, sourceLlvmValueBundle] = buildLlvmCall(
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
            context.throwError('Topological sort failed: Operations are not a DAG');
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
    switch(entry.operator) {
        case undefined:
        case BasicBackend.symbolByName.Void:
            context.throwError('Tried calling Void as Operator');
        case BasicBackend.symbolByName.DeferEvaluation:
            executePrimitiveDeferEvaluation(context, entry);
            break;
        case BasicBackend.symbolByName.Bundle:
            executePrimitiveBundle(context, entry);
            break;
        case BasicBackend.symbolByName.Unbundle:
            executePrimitiveUnbundle(context, entry);
            break;
        case BasicBackend.symbolByName.Addition:
        case BasicBackend.symbolByName.Subtraction:
        case BasicBackend.symbolByName.Multiplication:
            executePrimitiveBinaryInstruction(context, entry, function(output, intputL, intputR) {
                return [
                    output,
                    new LLVMBinaryInstruction(new LLVMValue(intputL.type), context.llvmLookupMaps.binaryArithmetic.get(entry.operator), intputL, intputR)
                ];
            }, function(intputL, intputR) {
                switch(entry.operator) {
                    case BasicBackend.symbolByName.Addition:
                        return intputL+intputR;
                    case BasicBackend.symbolByName.Subtraction:
                        return intputL-intputR;
                    case BasicBackend.symbolByName.Multiplication:
                        return intputL*intputR;
                }
            });
            break;
        case BasicBackend.symbolByName.Equal:
        case BasicBackend.symbolByName.NotEqual:
        case BasicBackend.symbolByName.LessThan:
        case BasicBackend.symbolByName.LessEqual:
        case BasicBackend.symbolByName.GreaterThan:
        case BasicBackend.symbolByName.GreaterEqual:
            executePrimitiveBinaryInstruction(context, entry, function(output, intputL, intputR) {
                const encoding = context.ontology.getSolitary(context.ontology.getSolitary(output, BasicBackend.symbolByName.PlaceholderEncoding), BasicBackend.symbolByName.Default),
                      prefix = ((encoding === BasicBackend.symbolByName.BinaryNumber || encoding === BasicBackend.symbolByName.TwosComplement) &&
                                (entry.operator === BasicBackend.symbolByName.Equal || entry.operator === BasicBackend.symbolByName.NotEqual))
                                ? '' : context.llvmLookupMaps.binaryComparisonPrefix.get(encoding);
                return [
                    BasicBackend.symbolByName.Boolean,
                    new LLVMCompareInstruction(new LLVMValue(new LLVMIntegerType(1)), prefix+context.llvmLookupMaps.binaryComparison.get(entry.operator), intputL, intputR)
                ];
            }, function(intputL, intputR) {
                switch(entry.operator) {
                    case BasicBackend.symbolByName.Equal:
                        return intputL == intputR;
                    case BasicBackend.symbolByName.NotEqual:
                        return intputL != intputR;
                    case BasicBackend.symbolByName.LessThan:
                        return intputL < intputR;
                    case BasicBackend.symbolByName.LessEqual:
                        return intputL <= intputR;
                    case BasicBackend.symbolByName.GreaterThan:
                        return intputL > intputR;
                    case BasicBackend.symbolByName.GreaterEqual:
                        return intputL >= intputR;
                }
            });
            break;
        case BasicBackend.symbolByName.If:
            executePrimitiveIf(context, entry);
            break;
        default:
            executeCustomOperator(context, entry);
            break;
    }
    return entry;
}
