package com.teeuan.shabuwrapper;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.RemoteException;
import android.os.SystemClock;
import android.util.Log;

import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.SunmiPrinterService;

import org.json.JSONObject;

import java.util.concurrent.locks.ReentrantLock;

public class SunmiQrPrinterManager {
    private static final String TAG = "SunmiQrPrinterManager";
    private static final int MAX_PRINT_ATTEMPTS = 3;
    private static final long PRINTER_WAIT_TIMEOUT_MS = 2400L;
    private static final int STATUS_UNKNOWN_OR_UNINITIALIZED = 0;
    private static final int STATUS_NORMAL = 1;
    private static final int STATUS_PREPARING = 2;
    private static final int STATUS_COMMUNICATION = 3;
    private static final int STATUS_OUT_OF_PAPER = 4;
    private static final int STATUS_OVERHEATED = 5;
    private static final int STATUS_COVER_OPEN = 6;
    private static final int STATUS_CUTTER_ERROR = 7;
    private static final int STATUS_BLACK_MARK_NOT_DETECTED = 9;
    private static final int STATUS_NO_PRINTER_DETECTED = 505;
    private static final int STATUS_FIRMWARE_UPDATING = 507;
    private static final int MAX_LOGO_WIDTH_PX = 280;
    private static final int MIN_LOGO_WIDTH_PX = 96;

    private final Context context;
    private final ReentrantLock printLock = new ReentrantLock();
    private volatile SunmiPrinterService printerService;
    private volatile boolean isBound = false;

    private final InnerPrinterCallback connectionCallback = new InnerPrinterCallback() {
        @Override
        public void onConnected(SunmiPrinterService service) {
            printerService = service;
            Log.i(TAG, "SUNMI printer connected");
        }

        @Override
        public void onDisconnected() {
            printerService = null;
            Log.w(TAG, "SUNMI printer disconnected");
        }
    };

    public SunmiQrPrinterManager(Context context) {
        this.context = context.getApplicationContext();
    }

    public void bind() {
        if (isBound) return;
        try {
            boolean connected = InnerPrinterManager.getInstance().bindService(context, connectionCallback);
            isBound = connected;
            if (!connected) {
                Log.w(TAG, "bindService returned false");
            }
        } catch (Exception error) {
            Log.e(TAG, "bind failed", error);
        }
    }

    public void unbind() {
        if (!isBound) return;
        try {
            InnerPrinterManager.getInstance().unBindService(context, connectionCallback);
        } catch (Exception error) {
            Log.e(TAG, "unbind failed", error);
        } finally {
            isBound = false;
            printerService = null;
        }
    }

    public PrintResult printQrSlip(JSONObject data) {
        String restaurantName = safeText(data.optString("restaurantName", "ตี๋อ้วน สุกี้ชาบู"));
        String tableNumber = safeText(data.optString("tableNumber", "-"));
        String packageName = safeText(data.optString("packageName", "-"));
        String openedAt = safeText(data.optString("openedAt", "-"));
        String printedAt = safeText(data.optString("printedAt", "-"));
        String qrUrl = data.optString("qrUrl", "").trim();

        if (qrUrl.isEmpty()) {
            return PrintResult.error("missing_qr_url", null, null, null);
        }

        printLock.lock();
        try {
            for (int attempt = 1; attempt <= MAX_PRINT_ATTEMPTS; attempt++) {
                SunmiPrinterService service = awaitPrinterService(PRINTER_WAIT_TIMEOUT_MS);
                if (service == null) {
                    Log.w(TAG, "attempt " + attempt + ": printer service unavailable");
                    forceRebind();
                    continue;
                }

                try {
                    int status = service.updatePrinterState();
                    Integer mode = tryGetPrinterMode(service);
                    Integer paper = tryGetPrinterPaper(service);
                    Log.i(TAG, "attempt " + attempt + " state: status=" + status + "(" + statusDescription(status) + "), mode=" + mode + ", paper=" + paper);

                    if (!isPrintableStatus(status)) {
                        return PrintResult.error("printer_state_" + statusDescription(status), status, mode, paper);
                    }

                    service.printerInit(null);
                    service.setAlignment(1, null);

                    Bitmap logo = loadLogo();
                    if (logo != null) {
                        service.printBitmap(logo, null);
                        service.lineWrap(1, null);
                    }

                    service.printTextWithFont(restaurantName + "\n", null, 32.0f, null);
                    service.printText("--------------------------------\n", null);
                    service.printTextWithFont("โต๊ะ " + tableNumber + "\n", null, 42.0f, null);
                    service.printTextWithFont(packageName + "\n", null, 28.0f, null);
                    service.printText("เวลาเปิดโต๊ะ: " + openedAt + "\n", null);
                    service.printText("เวลาพิมพ์: " + printedAt + "\n", null);
                    service.printText("--------------------------------\n", null);
                    service.lineWrap(1, null);
                    service.printQRCode(qrUrl, 8, 3, null);
                    service.lineWrap(1, null);
                    service.printTextWithFont("สแกน QR เพื่อสั่งอาหาร\n", null, 24.0f, null);
                    service.printText("ผ่านโทรศัพท์ของลูกค้า\n", null);
                    service.printText("--------------------------------\n", null);
                    service.lineWrap(4, null);

                    tryAutoOutPaper(service);
                    return PrintResult.ok(status, mode, paper);
                } catch (Exception error) {
                    Log.e(TAG, "attempt " + attempt + " failed", error);
                    forceRebind();
                }
            }

            return PrintResult.error("printer_unavailable", null, null, null);
        } finally {
            printLock.unlock();
        }
    }

    private SunmiPrinterService awaitPrinterService(long timeoutMs) {
        if (printerService != null) return printerService;
        if (!isBound) bind();

        long deadline = SystemClock.uptimeMillis() + timeoutMs;
        while (SystemClock.uptimeMillis() < deadline) {
            if (printerService != null) return printerService;
            SystemClock.sleep(80);
        }
        return printerService;
    }

    private void forceRebind() {
        try {
            if (isBound) {
                InnerPrinterManager.getInstance().unBindService(context, connectionCallback);
            }
        } catch (Exception ignored) {
        } finally {
            isBound = false;
            printerService = null;
        }
        bind();
        SystemClock.sleep(120);
    }

    private Bitmap loadLogo() {
        try {
            Bitmap raw = BitmapFactory.decodeResource(context.getResources(), R.drawable.logo);
            if (raw == null) return null;

            int targetWidth = Math.max(MIN_LOGO_WIDTH_PX, Math.min(MAX_LOGO_WIDTH_PX, raw.getWidth()));
            int targetHeight = Math.max(1, Math.round(raw.getHeight() * (targetWidth / (float) raw.getWidth())));
            Bitmap scaled = Bitmap.createScaledBitmap(raw, targetWidth, targetHeight, true);
            if (scaled != raw) {
                raw.recycle();
            }

            Bitmap flattened = Bitmap.createBitmap(scaled.getWidth(), scaled.getHeight(), Bitmap.Config.RGB_565);
            Canvas canvas = new Canvas(flattened);
            canvas.drawColor(Color.WHITE);
            canvas.drawBitmap(scaled, 0f, 0f, new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG));
            scaled.recycle();
            return flattened;
        } catch (Exception error) {
            Log.w(TAG, "Failed to load print logo", error);
            return null;
        }
    }

    private Integer tryGetPrinterMode(SunmiPrinterService service) {
        try {
            return service.getPrinterMode();
        } catch (Exception error) {
            return null;
        }
    }

    private Integer tryGetPrinterPaper(SunmiPrinterService service) {
        try {
            return service.getPrinterPaper();
        } catch (Exception error) {
            return null;
        }
    }

    private void tryAutoOutPaper(SunmiPrinterService service) {
        try {
            service.autoOutPaper(null);
        } catch (RemoteException error) {
            Log.w(TAG, "autoOutPaper failed", error);
        } catch (Exception error) {
            Log.w(TAG, "autoOutPaper unavailable", error);
        }
    }

    private boolean isPrintableStatus(int status) {
        return status == STATUS_UNKNOWN_OR_UNINITIALIZED
            || status == STATUS_NORMAL
            || status == STATUS_PREPARING;
    }

    private String statusDescription(int status) {
        switch (status) {
            case STATUS_NORMAL:
                return "normal";
            case STATUS_PREPARING:
                return "preparing";
            case STATUS_UNKNOWN_OR_UNINITIALIZED:
                return "unknown_or_uninitialized";
            case STATUS_COMMUNICATION:
                return "communication_error";
            case STATUS_OUT_OF_PAPER:
                return "out_of_paper";
            case STATUS_OVERHEATED:
                return "overheated";
            case STATUS_COVER_OPEN:
                return "cover_open";
            case STATUS_CUTTER_ERROR:
                return "cutter_error";
            case STATUS_BLACK_MARK_NOT_DETECTED:
                return "black_mark_not_detected";
            case STATUS_NO_PRINTER_DETECTED:
                return "no_printer_detected";
            case STATUS_FIRMWARE_UPDATING:
                return "firmware_updating";
            default:
                return "unknown_" + status;
        }
    }

    private String safeText(String rawValue) {
        if (rawValue == null) return "-";
        String normalized = rawValue.trim();
        if (normalized.isEmpty()) return "-";
        return normalized.replace("\n", " ");
    }
}
