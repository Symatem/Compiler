const [gcdRecOperator, gcdRecOperations] = context.createOperator(2),
      [thenOperator, thenOperations] = context.createOperator(0),
      [elseOperator, elseOperations] = context.createOperator(2);

context.ontology.setData(gcdRecOperator, 'GcdRec');
context.createCarrier(gcdRecOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Equal);
context.createCarrier(gcdRecOperations[0], BasicBackend.symbolByName.Input, gcdRecOperator, BasicBackend.symbolByName.OtherInput);
context.createCarrier(gcdRecOperations[0], BasicBackend.symbolByName.Comparand, BasicBackend.symbolByName.Zero);
context.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.If);
context.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Condition, gcdRecOperations[0], BasicBackend.symbolByName.Output);
context.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Then, thenOperator);
context.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Else, elseOperator);
context.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Input, gcdRecOperator, BasicBackend.symbolByName.Input);
context.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.OtherInput, gcdRecOperator, BasicBackend.symbolByName.OtherInput);
context.createCarrier(gcdRecOperator, BasicBackend.symbolByName.Output, gcdRecOperations[1], BasicBackend.symbolByName.Output);

context.ontology.setData(thenOperator, 'GcdRecThen');
context.createCarrier(thenOperator, BasicBackend.symbolByName.Output, thenOperator, BasicBackend.symbolByName.Input);

context.ontology.setData(elseOperator, 'GcdRecElse');
context.createCarrier(elseOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Division);
context.createCarrier(elseOperations[0], BasicBackend.symbolByName.Dividend, elseOperator, BasicBackend.symbolByName.Input);
context.createCarrier(elseOperations[0], BasicBackend.symbolByName.Divisor, elseOperator, BasicBackend.symbolByName.OtherInput);
context.createCarrier(elseOperations[1], BasicBackend.symbolByName.Operator, gcdRecOperator);
context.createCarrier(elseOperations[1], BasicBackend.symbolByName.Input, elseOperator, BasicBackend.symbolByName.OtherInput);
context.createCarrier(elseOperations[1], BasicBackend.symbolByName.OtherInput, elseOperations[0], BasicBackend.symbolByName.Rest);
context.createCarrier(elseOperator, BasicBackend.symbolByName.Output, elseOperations[1], BasicBackend.symbolByName.Output);

const inputs = new Map();
inputs.set(BasicBackend.symbolByName.Operator, gcdRecOperator);
inputs.set(BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Natural32);
inputs.set(BasicBackend.symbolByName.OtherInput, BasicBackend.symbolByName.Natural32);
inputs;
