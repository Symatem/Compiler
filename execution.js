import { LLVMValue, LLVMBasicBlock, LLVMFunction } from './LLVM/Value.js';
import { LLVMReturnInstruction, LLVMBranchInstruction, LLVMConditionalBranchInstruction, LLVMBinaryInstruction, LLVMCompareInstruction, LLVMPhiInstruction } from './LLVM/Instruction.js';
import { encodingToLlvmType } from './values.js';
import { hashOfOperands, deferEvaluation, getTypedPlaceholder, convertSources, bundleOperands, bundleLLVMValues, collectDestinations, propagateSources, buildLlvmCall, buildLLVMFunction, finishExecution } from './utils.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';



function executePrimitiveDeferEvaluation(context, entry) {
    let outputOperand = entry.inputOperands.get(BasicBackend.symbolByName.Input),
        outputLlvmValue = entry.aux.inputLlvmValues.get(BasicBackend.symbolByName.Input);
    if(!outputLlvmValue)
        [outputOperand, outputLlvmValue] = deferEvaluation(context, outputOperand);
    entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
    entry.aux.llvmBasicBlock = new LLVMBasicBlock();
    entry.aux.llvmBasicBlock.instructions = [
        new LLVMReturnInstruction(outputLlvmValue)
    ];
    buildLLVMFunction(context, entry, outputLlvmValue.type);
    finishExecution(context, entry);
}

function executePrimitiveBinaryInstruction(context, entry, compileCallback, interpretCallback) {
    entry.aux.llvmBasicBlock = new LLVMBasicBlock();
    const inputL = entry.inputOperands.get(BasicBackend.symbolByName.InputL),
          inputR = entry.inputOperands.get(BasicBackend.symbolByName.InputR);
    if(entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.InputL) || entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.InputR)) {
        const inputLlvmValueL = getTypedPlaceholder(context, BasicBackend.symbolByName.InputL, entry.inputOperands, entry.aux.inputLlvmValues)[1],
              inputLlvmValueR = getTypedPlaceholder(context, BasicBackend.symbolByName.InputR, entry.inputOperands, entry.aux.inputLlvmValues)[1];
        if(inputLlvmValueL.type !== inputLlvmValueR.type)
            throw new Error('InputL and InputR type mismatch');
        const [outputSymbol, operation] = compileCallback(inputL, inputLlvmValueL, inputLlvmValueR);
        entry.outputOperands.set(BasicBackend.symbolByName.Output, outputSymbol);
        operation.result = new LLVMValue(encodingToLlvmType(context, context.ontology.getSolitary(outputSymbol, BasicBackend.symbolByName.PlaceholderEncoding)));
        buildLLVMFunction(context, entry, operation.result.type);
        entry.aux.llvmBasicBlock.instructions = [
            operation,
            new LLVMReturnInstruction(operation.result)
        ];
    } else {
        const output = interpretCallback(context.ontology.getData(inputL), context.ontology.getData(inputR)),
              outputSymbol = context.ontology.createSymbol(context.executionNamespaceId);
        context.ontology.setData(outputSymbol, output);
        entry.outputOperands.set(BasicBackend.symbolByName.Output, outputSymbol);
    }
    finishExecution(context, entry);
}

function executePrimitiveIf(context, entry) {
    entry.aux.llvmBasicBlock = new LLVMBasicBlock();
    entry.aux.operatDestinationLlvmValues = [];
    entry.aux.operatDestinationOperands = [];
    entry.aux.operationsBlockedByThis = new Map();
    entry.aux.readyOperations = [0, 1];
    entry.aux.blockedOperations = new Set();
    for(const operation of entry.aux.readyOperations) {
        const branch = (operation) ? 'Else' : 'Then';
        entry.aux.operatDestinationLlvmValues[operation] = new Map([
            [BasicBackend.symbolByName.Input, entry.aux.inputLlvmValues.get(BasicBackend.symbolByName.Input)],
            // TODO: LLVMFunctionType; [BasicBackend.symbolByName.Operator, entry.aux.inputLlvmValues.get(BasicBackend.symbolByName[branch])]
        ]);
        entry.aux.operatDestinationOperands[operation] = new Map([
            [BasicBackend.symbolByName.Input, entry.inputOperands.get(BasicBackend.symbolByName.Input)],
            [BasicBackend.symbolByName.Operator, entry.inputOperands.get(BasicBackend.symbolByName[branch])]
        ]);
    }
    if(!entry.aux.inputLlvmValues.has(BasicBackend.symbolByName.Condition)) {
        const operation = context.ontology.getData(entry.inputOperands.get(BasicBackend.symbolByName.Condition)) ? 0 : 1;
        entry.aux.resume = function() {
            const [instanceEntry, sourceLlvmValues] = buildLlvmCall(
                context, entry, operation, entry.aux.llvmBasicBlock,
                entry.aux.operatDestinationOperands[operation],
                entry.aux.operatDestinationLlvmValues[operation]
            );
            if(!sourceLlvmValues)
                return;
            const [outputOperand, outputLlvmValue] = getTypedPlaceholder(context, BasicBackend.symbolByName.Output, instanceEntry.outputOperands, sourceLlvmValues);
            entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
            if(instanceEntry.llvmFunction) {
                entry.aux.llvmBasicBlock.instructions.push(new LLVMReturnInstruction(outputLlvmValue));
                buildLLVMFunction(context, entry, outputLlvmValue.type);
            }
            finishExecution(context, entry);
        };
        entry.aux.resume();
        return;
    }
    entry.aux.branchToExit = new LLVMBranchInstruction(new LLVMBasicBlock());
    entry.aux.phiInstruction = new LLVMPhiInstruction(undefined, [], [new LLVMBasicBlock(), new LLVMBasicBlock()]);
    entry.aux.resume = function() {
        while(entry.aux.readyOperations.length > 0) {
            const operation = entry.aux.readyOperations.shift(),
                  label = entry.aux.phiInstruction.caseLabels[operation],
                  [instanceEntry, sourceLlvmValues] = buildLlvmCall(
                context, entry, operation, label,
                entry.aux.operatDestinationOperands[operation],
                entry.aux.operatDestinationLlvmValues[operation]
            );
            if(!sourceLlvmValues)
                continue;
            label.instructions[0].attributes.push('alwaysinline');
            label.instructions.push(entry.aux.branchToExit);
            const [outputOperand, outputLlvmValue] = getTypedPlaceholder(context, BasicBackend.symbolByName.Output, instanceEntry.outputOperands, sourceLlvmValues);
            entry.aux.phiInstruction.caseValues[operation] = outputLlvmValue;
            if(entry.aux.ready) {
                if(entry.aux.phiInstruction.caseValues[0].type !== entry.aux.phiInstruction.caseValues[1].type)
                    throw new Error('Then Output and Else Output type mismatch');
                continue;
            }
            entry.outputOperands.set(BasicBackend.symbolByName.Output, outputOperand);
            buildLLVMFunction(context, entry, outputLlvmValue.type);
            entry.aux.phiInstruction.result = new LLVMValue(outputLlvmValue.type);
            entry.aux.branchToExit.destinationLabel.instructions = [
                entry.aux.phiInstruction,
                new LLVMReturnInstruction(entry.aux.phiInstruction.result)
            ];
            entry.llvmFunction.basicBlocks[0].instructions = [new LLVMConditionalBranchInstruction(
                getTypedPlaceholder(context, BasicBackend.symbolByName.Condition, entry.inputOperands, entry.aux.inputLlvmValues)[1],
                entry.aux.phiInstruction.caseLabels[0],
                entry.aux.phiInstruction.caseLabels[1]
            )];
            entry.llvmFunction.basicBlocks.splice(1, 0,
                entry.aux.phiInstruction.caseLabels[0],
                entry.aux.phiInstruction.caseLabels[1],
                entry.aux.branchToExit.destinationLabel
            );
            entry.aux.ready = true;
        }
        if(entry.aux.blockedOperations.size > 0)
            return;
        finishExecution(context, entry);
    };
    entry.aux.resume();
}

function executeCustomOperator(context, entry) {
    entry.aux.llvmBasicBlock = new LLVMBasicBlock();
    entry.aux.operatDestinationLlvmValues = new Map();
    entry.aux.operatDestinationOperands = new Map();
    entry.aux.operationsBlockedByThis = new Map();
    entry.aux.unsatisfiedOperations = new Map();
    entry.aux.readyOperations = [];
    entry.aux.blockedOperations = new Set();
    entry.aux.resume = function() {
        while(entry.aux.readyOperations.length > 0) {
            const operation = entry.aux.readyOperations.shift(),
                  [instanceEntry, sourceLlvmValues] = buildLlvmCall(
                context,
                entry,
                operation,
                entry.aux.llvmBasicBlock,
                entry.aux.operatDestinationOperands.get(operation),
                entry.aux.operatDestinationLlvmValues.get(operation)
            );
            if(sourceLlvmValues)
                propagateSources(context, entry, operation, instanceEntry.outputOperands, sourceLlvmValues);
        }
        if(entry.aux.blockedOperations.size > 0)
            return;
        if(entry.aux.unsatisfiedOperations.size > 0)
            throw new Error('Operations are not a DAG, topological sort not possible');
        const returnLlvmValue = bundleLLVMValues(context, entry.aux.llvmBasicBlock, Array.from(entry.aux.outputLlvmValues.values()));
        entry.aux.llvmBasicBlock.instructions.push(new LLVMReturnInstruction(returnLlvmValue));
        buildLLVMFunction(context, entry, returnLlvmValue.type, false);
        finishExecution(context, entry);
    };
    for(const triple of context.ontology.queryTriples(BasicBackend.queryMask.MMV, [entry.operator, BasicBackend.symbolByName.Operation, BasicBackend.symbolByName.Void]))
        collectDestinations(context, entry, triple[2]);
    collectDestinations(context, entry, entry.operator);
    propagateSources(context, entry, entry.operator, entry.inputOperands, entry.aux.inputLlvmValues);
    entry.aux.resume();
}

export function execute(context, inputOperands) {
    const entry = {'inputOperands': inputOperands},
          parts = [];
    entry.operator = entry.inputOperands.get(BasicBackend.symbolByName.Operator);
    entry.inputOperands = entry.inputOperands.sorted();
    entry.hash = hashOfOperands(context, entry.inputOperands);
    if(context.operatorInstanceByHash.has(entry.hash))
        return context.operatorInstanceByHash.get(entry.hash);
    entry.outputOperands = new Map();
    entry.aux = {'inputLlvmValues': convertSources(context, entry.inputOperands)};
    entry.symbol = context.ontology.createSymbol(context.executionNamespaceId);
    context.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.Operator, entry.operator], true);
    context.ontology.setTriple([entry.symbol, BasicBackend.symbolByName.InputOperands, bundleOperands(context, entry.inputOperands)], true);
    context.operatorInstanceBySymbol.set(entry.symbol, entry);
    context.operatorInstanceByHash.set(entry.hash, entry);
    switch(entry.operator) {
        case BasicBackend.symbolByName.DeferEvaluation:
            executePrimitiveDeferEvaluation(context, entry);
            break;
        case BasicBackend.symbolByName.Addition:
        case BasicBackend.symbolByName.Subtraction:
        case BasicBackend.symbolByName.Multiplication:
            executePrimitiveBinaryInstruction(context, entry, function(output, intputL, intputR) {
                return [output, new LLVMBinaryInstruction(undefined, context.llvmLookupMaps.binaryArithmetic.get(entry.operator), intputL, intputR)];
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
                                ? '' : context.llvmLookupMaps.binaryComparisonPrefix.get(encoding),
                      operation = new LLVMCompareInstruction(undefined, prefix+context.llvmLookupMaps.binaryComparison.get(entry.operator), intputL, intputR);
                return [BasicBackend.symbolByName.Boolean, operation];
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
