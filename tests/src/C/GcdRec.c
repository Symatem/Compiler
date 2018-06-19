unsigned int GcdRec(unsigned int x, unsigned int y) {
    return (y == 0) ? x : GcdRec(y, x%y);
}
