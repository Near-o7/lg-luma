varying PAINT_PRECISION vec4 v_color;
varying PAINT_PRECISION float v_coverage;
void main() {
    gl_FragColor = vec4(v_color.rgb, v_color.a * clamp(v_coverage, 0.0, 1.0));
}
