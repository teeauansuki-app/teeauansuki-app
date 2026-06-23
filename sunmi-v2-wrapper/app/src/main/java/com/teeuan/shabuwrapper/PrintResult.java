package com.teeuan.shabuwrapper;

public class PrintResult {
    public final boolean ok;
    public final Integer statusCode;
    public final Integer modeCode;
    public final Integer paperCode;
    public final String reason;

    public PrintResult(boolean ok, Integer statusCode, Integer modeCode, Integer paperCode, String reason) {
        this.ok = ok;
        this.statusCode = statusCode;
        this.modeCode = modeCode;
        this.paperCode = paperCode;
        this.reason = reason;
    }

    public static PrintResult ok(Integer statusCode, Integer modeCode, Integer paperCode) {
        return new PrintResult(true, statusCode, modeCode, paperCode, null);
    }

    public static PrintResult error(String reason, Integer statusCode, Integer modeCode, Integer paperCode) {
        return new PrintResult(false, statusCode, modeCode, paperCode, reason);
    }
}
