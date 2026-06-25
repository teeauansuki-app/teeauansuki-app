package com.teeuan.shabuwrapper;

import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

public class SunmiPrinterBridge {
    private static final String TAG = "SunmiPrinterBridge";
    private final MainActivity mainActivity;
    private final SunmiQrPrinterManager printerManager;

    public SunmiPrinterBridge(MainActivity activity, SunmiQrPrinterManager printerManager) {
        this.mainActivity = activity;
        this.printerManager = printerManager;
    }

    @JavascriptInterface
    public String printQrSlip(String payloadJson) {
        try {
            JSONObject payload = new JSONObject(payloadJson);
            JSONObject data = payload.optJSONObject("data");
            if (data == null) {
                data = payload;
            }

            PrintResult result = printerManager.printQrSlip(data);
            if (result.ok) {
                showToast("พิมพ์ QR เรียบร้อยแล้ว");
                return "ok";
            }

            String reason = result.reason == null ? "printer_unavailable" : result.reason;
            showToast("พิมพ์ QR ไม่สำเร็จ: " + reason);
            return "error:" + reason;
        } catch (Exception error) {
            Log.e(TAG, "printQrSlip failed", error);
            showToast("พิมพ์ QR ไม่สำเร็จ: " + error.getMessage());
            return "error:" + (error.getMessage() == null ? "unknown_error" : error.getMessage());
        }
    }

    @JavascriptInterface
    public String offlineLogin(String pin) {
        return mainActivity.validateOfflinePin(pin) ? "ok" : "error:invalid_pin";
    }

    @JavascriptInterface
    public String printOfflineQr(String tableNumber, String packageId) {
        try {
            String normalizedTable = tableNumber == null ? "" : tableNumber.trim();
            String normalizedPackage = "premium".equals(packageId) ? "premium" : "standard";
            if (normalizedTable.isEmpty()) {
                return "error:missing_table_number";
            }

            String sessionId = UUID.randomUUID().toString();
            String packageName = "premium".equals(normalizedPackage) ? "Premium" : "Standard";
            String now = new SimpleDateFormat("HH:mm", Locale.forLanguageTag("th-TH")).format(new Date());
            String qrUrl = mainActivity.getOrderBaseUrl()
                    + "/s/" + sessionId
                    + "?offline=1&t=" + normalizedTable
                    + "&p=" + normalizedPackage;

            JSONObject data = new JSONObject();
            data.put("restaurantName", "ตี๋อ้วน สุกี้ชาบู");
            data.put("tableNumber", normalizedTable);
            data.put("packageName", packageName);
            data.put("openedAt", now);
            data.put("printedAt", now);
            data.put("qrUrl", qrUrl);

            PrintResult result = printerManager.printQrSlip(data);
            if (result.ok) {
                showToast("พิมพ์ QR ออฟไลน์เรียบร้อยแล้ว");
                return "ok:" + qrUrl;
            }

            String reason = result.reason == null ? "printer_unavailable" : result.reason;
            showToast("พิมพ์ QR ไม่สำเร็จ: " + reason);
            return "error:" + reason;
        } catch (Exception error) {
            Log.e(TAG, "printOfflineQr failed", error);
            showToast("พิมพ์ QR ไม่สำเร็จ: " + error.getMessage());
            return "error:" + (error.getMessage() == null ? "unknown_error" : error.getMessage());
        }
    }

    @JavascriptInterface
    public String printQR(String tableNumber, String packageName, String openedAt, String qrUrl) {
        try {
            JSONObject data = new JSONObject();
            data.put("restaurantName", "ตี๋อ้วน สุกี้ชาบู");
            data.put("tableNumber", tableNumber);
            data.put("packageName", packageName);
            data.put("openedAt", openedAt);
            data.put("printedAt", openedAt);
            data.put("qrUrl", qrUrl);
            JSONObject payload = new JSONObject();
            payload.put("type", "qr_slip");
            payload.put("version", 1);
            payload.put("source", "tee-uan-cashier-web");
            payload.put("data", data);
            return printQrSlip(payload.toString());
        } catch (Exception error) {
            Log.e(TAG, "printQR failed", error);
            return "error:" + (error.getMessage() == null ? "unknown_error" : error.getMessage());
        }
    }

    private void showToast(final String message) {
        mainActivity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(mainActivity.getApplicationContext(), message, Toast.LENGTH_LONG).show();
            }
        });
    }
}
