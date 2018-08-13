function(program) {
    const [fibRecOperator, fibRecOperations] = program.createOperator(2),
          [thenOperator, thenOperations] = program.createOperator(0),
          [elseOperator, elseOperations] = program.createOperator(5);

    program.ontology.setData(fibRecOperator, 'FibRec');
    program.createCarrier(fibRecOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.LessThan);
    program.createCarrier(fibRecOperations[0], BasicBackend.symbolByName.Input, fibRecOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(fibRecOperations[0], BasicBackend.symbolByName.Comparand, BasicBackend.symbolByName.Two);
    program.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.If);
    program.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Condition, fibRecOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Then, thenOperator);
    program.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Else, elseOperator);
    program.createCarrier(fibRecOperations[1], BasicBackend.symbolByName.Input, fibRecOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(fibRecOperator, BasicBackend.symbolByName.Output, fibRecOperations[1], BasicBackend.symbolByName.Output);

    program.ontology.setData(thenOperator, 'FibRecThen');
    program.createCarrier(thenOperator, BasicBackend.symbolByName.Output, thenOperator, BasicBackend.symbolByName.Input);

    program.ontology.setData(elseOperator, 'FibRecElse');
    program.createCarrier(elseOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Subtraction);
    program.createCarrier(elseOperations[0], BasicBackend.symbolByName.Minuend, elseOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(elseOperations[0], BasicBackend.symbolByName.Subtrahend, BasicBackend.symbolByName.Two);
    program.createCarrier(elseOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Subtraction);
    program.createCarrier(elseOperations[1], BasicBackend.symbolByName.Minuend, elseOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(elseOperations[1], BasicBackend.symbolByName.Subtrahend, BasicBackend.symbolByName.One);
    program.createCarrier(elseOperations[2], BasicBackend.symbolByName.Operator, fibRecOperator);
    program.createCarrier(elseOperations[2], BasicBackend.symbolByName.Input, elseOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(elseOperations[3], BasicBackend.symbolByName.Operator, fibRecOperator);
    program.createCarrier(elseOperations[3], BasicBackend.symbolByName.Input, elseOperations[1], BasicBackend.symbolByName.Output);
    program.createCarrier(elseOperations[4], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Addition);
    program.createCarrier(elseOperations[4], BasicBackend.symbolByName.Input, elseOperations[2], BasicBackend.symbolByName.Output);
    program.createCarrier(elseOperations[4], BasicBackend.symbolByName.OtherInput, elseOperations[3], BasicBackend.symbolByName.Output);
    program.createCarrier(elseOperator, BasicBackend.symbolByName.Output, elseOperations[4], BasicBackend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(BasicBackend.symbolByName.Operator, fibRecOperator);
    inputs.set(BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Natural32);
    return inputs;
}
