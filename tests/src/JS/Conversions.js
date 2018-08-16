function(program) {
    const [conversionsOperator, conversionsOperations] = program.createOperator(10),
          encodingNatural32 = program.ontology.getSolitary(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.PlaceholderEncoding),
          encodingNatural64 = program.ontology.getSolitary(BasicBackend.symbolByName.Natural64, BasicBackend.symbolByName.PlaceholderEncoding),
          encodingInteger32 = program.ontology.getSolitary(BasicBackend.symbolByName.Integer32, BasicBackend.symbolByName.PlaceholderEncoding),
          encodingInteger64 = program.ontology.getSolitary(BasicBackend.symbolByName.Integer64, BasicBackend.symbolByName.PlaceholderEncoding),
          encodingFloat32 = program.ontology.getSolitary(BasicBackend.symbolByName.Float32, BasicBackend.symbolByName.PlaceholderEncoding),
          encodingFloat64 = program.ontology.getSolitary(BasicBackend.symbolByName.Float64, BasicBackend.symbolByName.PlaceholderEncoding);

    program.ontology.setData(conversionsOperator, 'Conversions');
    program.createCarrier(conversionsOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[0], BasicBackend.symbolByName.Input, conversionsOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(conversionsOperations[0], BasicBackend.symbolByName.PlaceholderEncoding, encodingNatural32);
    program.createCarrier(conversionsOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[1], BasicBackend.symbolByName.Input, conversionsOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(conversionsOperations[1], BasicBackend.symbolByName.PlaceholderEncoding, encodingInteger32);
    program.createCarrier(conversionsOperations[2], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[2], BasicBackend.symbolByName.Input, conversionsOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(conversionsOperations[2], BasicBackend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(conversionsOperations[3], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[3], BasicBackend.symbolByName.Input, conversionsOperations[1], BasicBackend.symbolByName.Output);
    program.createCarrier(conversionsOperations[3], BasicBackend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(conversionsOperations[4], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[4], BasicBackend.symbolByName.Input, conversionsOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(conversionsOperations[4], BasicBackend.symbolByName.PlaceholderEncoding, encodingNatural64);
    program.createCarrier(conversionsOperations[5], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[5], BasicBackend.symbolByName.Input, conversionsOperations[1], BasicBackend.symbolByName.Output);
    program.createCarrier(conversionsOperations[5], BasicBackend.symbolByName.PlaceholderEncoding, encodingInteger64);
    program.createCarrier(conversionsOperations[6], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[6], BasicBackend.symbolByName.Input, conversionsOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(conversionsOperations[6], BasicBackend.symbolByName.PlaceholderEncoding, encodingFloat64);
    program.createCarrier(conversionsOperations[7], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[7], BasicBackend.symbolByName.Input, conversionsOperations[4], BasicBackend.symbolByName.Output);
    program.createCarrier(conversionsOperations[7], BasicBackend.symbolByName.PlaceholderEncoding, encodingNatural32);
    program.createCarrier(conversionsOperations[8], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[8], BasicBackend.symbolByName.Input, conversionsOperations[5], BasicBackend.symbolByName.Output);
    program.createCarrier(conversionsOperations[8], BasicBackend.symbolByName.PlaceholderEncoding, encodingInteger32);
    program.createCarrier(conversionsOperations[9], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[9], BasicBackend.symbolByName.Input, conversionsOperations[6], BasicBackend.symbolByName.Output);
    program.createCarrier(conversionsOperations[9], BasicBackend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(conversionsOperator, BasicBackend.symbolByName.Output, conversionsOperations[9], BasicBackend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(BasicBackend.symbolByName.Operator, conversionsOperator);
    inputs.set(BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Float32);
    return inputs;
}
