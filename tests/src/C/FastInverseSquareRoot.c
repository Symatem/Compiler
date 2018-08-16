float FastInverseSquareRoot(float x) {
    union {
        float f;
        unsigned int i;
    } convert = {x};
    float half = x*0.5F;
    convert.i = 0x5F3759DF-(convert.i>>1);
    convert.f *= 1.5F-(half*convert.f*convert.f);
    return convert.f;
}
