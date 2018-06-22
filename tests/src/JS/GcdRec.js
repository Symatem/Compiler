(function(program) {
    const [gcdRecOperator, gcdRecOperations] = program.createOperator(2),
          [thenOperator, thenOperations] = program.createOperator(0),
          [elseOperator, elseOperations] = program.createOperator(2);

    program.ontology.setData(gcdRecOperator, 'GcdRec');
    program.createCarrier(gcdRecOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Equal);
    program.createCarrier(gcdRecOperations[0], BasicBackend.symbolByName.Input, gcdRecOperator, BasicBackend.symbolByName.OtherInput);
    program.createCarrier(gcdRecOperations[0], BasicBackend.symbolByName.Comparand, BasicBackend.symbolByName.Zero);
    program.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.If);
    program.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Condition, gcdRecOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Then, thenOperator);
    program.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Else, elseOperator);
    program.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.Input, gcdRecOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(gcdRecOperations[1], BasicBackend.symbolByName.OtherInput, gcdRecOperator, BasicBackend.symbolByName.OtherInput);
    program.createCarrier(gcdRecOperator, BasicBackend.symbolByName.Output, gcdRecOperations[1], BasicBackend.symbolByName.Output);

    program.ontology.setData(thenOperator, 'GcdRecThen');
    program.createCarrier(thenOperator, BasicBackend.symbolByName.Output, thenOperator, BasicBackend.symbolByName.Input);

    program.ontology.setData(elseOperator, 'GcdRecElse');
    program.createCarrier(elseOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Division);
    program.createCarrier(elseOperations[0], BasicBackend.symbolByName.Dividend, elseOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(elseOperations[0], BasicBackend.symbolByName.Divisor, elseOperator, BasicBackend.symbolByName.OtherInput);
    program.createCarrier(elseOperations[1], BasicBackend.symbolByName.Operator, gcdRecOperator);
    program.createCarrier(elseOperations[1], BasicBackend.symbolByName.Input, elseOperator, BasicBackend.symbolByName.OtherInput);
    program.createCarrier(elseOperations[1], BasicBackend.symbolByName.OtherInput, elseOperations[0], BasicBackend.symbolByName.Rest);
    program.createCarrier(elseOperator, BasicBackend.symbolByName.Output, elseOperations[1], BasicBackend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(BasicBackend.symbolByName.Operator, gcdRecOperator);
    inputs.set(BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Natural32);
    inputs.set(BasicBackend.symbolByName.OtherInput, BasicBackend.symbolByName.Natural32);
    return inputs;
})
