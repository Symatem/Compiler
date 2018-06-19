const [fibRecOperator, fibRecOperations] = context.createOperator(2),
      [thenOperator, thenOperations] = context.createOperator(0),
      [elseOperator, elseOperations] = context.createOperator(5);

context.ontology.setData(fibRecOperator, 'FibRec');
context.createCarrier(fibRecOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.LessThan);
context.createCarrier(fibRecOperations[0], BasicBackend.symbolByName.Input, fibRecOperator, BasicBackend.symbolByName.Input);
context.createCarrier(fibRecOperations[0], BasicBackend.symbolByName.Comparand, BasicBackend.symbolByName.Two);
context.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.If);
context.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Condition, fibRecOperations[0], BasicBackend.symbolByName.Output);
context.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Then, thenOperator);
context.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Else, elseOperator);
context.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Input, fibRecOperator, BasicBackend.symbolByName.Input);
context.createCarrier(fibRecOperator, BasicBackend.symbolByName.Output, fibRecOperations[1], BasicBackend.symbolByName.Output);

context.ontology.setData(thenOperator, 'FibRecThen');
context.createCarrier(thenOperator, BasicBackend.symbolByName.Output, thenOperator, BasicBackend.symbolByName.Input);

context.ontology.setData(elseOperator, 'FibRecElse');
context.createCarrier(elseOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Subtraction);
context.createCarrier(elseOperations[0], BasicBackend.symbolByName.Minuend, elseOperator, BasicBackend.symbolByName.Input);
context.createCarrier(elseOperations[0], BasicBackend.symbolByName.Subtrahend, BasicBackend.symbolByName.Two);
context.createCarrier(elseOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Subtraction);
context.createCarrier(elseOperations[1], BasicBackend.symbolByName.Minuend, elseOperator, BasicBackend.symbolByName.Input);
context.createCarrier(elseOperations[1], BasicBackend.symbolByName.Subtrahend, BasicBackend.symbolByName.One);
context.createCarrier(elseOperations[2], BasicBackend.symbolByName.Operator, fibRecOperator);
context.createCarrier(elseOperations[2], BasicBackend.symbolByName.Input, elseOperations[0], BasicBackend.symbolByName.Output);
context.createCarrier(elseOperations[3], BasicBackend.symbolByName.Operator, fibRecOperator);
context.createCarrier(elseOperations[3], BasicBackend.symbolByName.Input, elseOperations[1], BasicBackend.symbolByName.Output);
context.createCarrier(elseOperations[4], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Addition);
context.createCarrier(elseOperations[4], BasicBackend.symbolByName.Input, elseOperations[2], BasicBackend.symbolByName.Output);
context.createCarrier(elseOperations[4], BasicBackend.symbolByName.OtherInput, elseOperations[3], BasicBackend.symbolByName.Output);
context.createCarrier(elseOperator, BasicBackend.symbolByName.Output, elseOperations[4], BasicBackend.symbolByName.Output);

const inputs = new Map();
inputs.set(BasicBackend.symbolByName.Operator, fibRecOperator);
inputs.set(BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Natural32);
inputs;
