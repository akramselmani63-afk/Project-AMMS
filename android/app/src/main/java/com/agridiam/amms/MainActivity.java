package com.agridiam.amms;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int PICK_PHOTOS = 100;
    private static final int SAVE_BACKUP = 101;
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/assets/www/index.html";

    private final Handler mainThread = new Handler(Looper.getMainLooper());
    private WebView webView;
    private ValueCallback<Uri[]> photoCallback;
    private String pendingBackup;
    private Uri cameraPhotoUri;
    private File cameraPhotoFile;

    @Override
    protected void onCreate(@Nullable Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(11, 61, 120));
        getWindow().setNavigationBarColor(Color.WHITE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 246, 245));
        setContentView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ASSET_HOST.equals(uri.getHost()) && "https".equals(uri.getScheme()) && uri.getPath().startsWith("/assets/www/")) return false;
                if ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                        Toast.makeText(MainActivity.this, "No app can open this link.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
        });
        webView.addJavascriptInterface(new AppActions(), "AMMSNative");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (photoCallback != null) photoCallback.onReceiveValue(null);
                photoCallback = callback;
                try {
                    startActivityForResult(photoChooserIntent(params), PICK_PHOTOS);
                    return true;
                } catch (Exception error) {
                    photoCallback = null;
                    if (cameraPhotoFile != null) cameraPhotoFile.delete();
                    cameraPhotoUri = null;
                    cameraPhotoFile = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "Unable to open photos or camera.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        if (state == null || webView.restoreState(state) == null) {
            webView.loadUrl(START_URL);
        }
    }

    private Intent photoChooserIntent(WebChromeClient.FileChooserParams params) throws Exception {
        Intent photos = params.createIntent();
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) return photos;

        File cameraDirectory = new File(getCacheDir(), "camera");
        if (!cameraDirectory.exists() && !cameraDirectory.mkdirs()) return photos;
        cameraPhotoFile = File.createTempFile("amms-", ".jpg", cameraDirectory);
        cameraPhotoUri = FileProvider.getUriForFile(
                this, getPackageName() + ".fileprovider", cameraPhotoFile);
        camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
        camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

        Intent chooser = Intent.createChooser(photos, "Choose photos or take a new photo");
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        return chooser;
    }

    private final class AppActions {
        @JavascriptInterface
        public void saveBackup(String json) {
            mainThread.post(() -> {
                pendingBackup = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                String date = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                intent.putExtra(Intent.EXTRA_TITLE, "AMMS-backup-" + date + ".json");
                startActivityForResult(intent, SAVE_BACKUP);
            });
        }

        @JavascriptInterface
        public void printPage() {
            mainThread.post(() -> {
                PrintManager printer = (PrintManager) getSystemService(PRINT_SERVICE);
                if (printer != null && webView != null) {
                    printer.print("AMMS", webView.createPrintDocumentAdapter("AMMS"), new PrintAttributes.Builder().build());
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int request, int result, @Nullable Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_PHOTOS && photoCallback != null) {
            Uri[] files = null;
            if (result == RESULT_OK && data != null && data.getClipData() != null) {
                ArrayList<Uri> selected = new ArrayList<>();
                for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                    selected.add(data.getClipData().getItemAt(i).getUri());
                }
                files = selected.toArray(new Uri[0]);
            } else if (result == RESULT_OK && data != null && data.getData() != null) {
                files = new Uri[]{data.getData()};
            } else if (result == RESULT_OK && cameraPhotoUri != null
                    && cameraPhotoFile != null && cameraPhotoFile.length() > 0) {
                files = new Uri[]{cameraPhotoUri};
            }
            if (cameraPhotoFile != null
                    && (files == null || files.length == 0 || !cameraPhotoUri.equals(files[0]))) {
                cameraPhotoFile.delete();
            }
            photoCallback.onReceiveValue(files);
            photoCallback = null;
            cameraPhotoUri = null;
            cameraPhotoFile = null;
        } else if (request == SAVE_BACKUP) {
            if (result == RESULT_OK && data != null && data.getData() != null && pendingBackup != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output != null) {
                        output.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
                        Toast.makeText(this, "Backup saved.", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception error) {
                    Toast.makeText(this, "Could not save backup.", Toast.LENGTH_LONG).show();
                }
            }
            pendingBackup = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        if (webView != null) webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (photoCallback != null) photoCallback.onReceiveValue(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
