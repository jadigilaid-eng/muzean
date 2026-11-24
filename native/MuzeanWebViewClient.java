package com.muzean.app;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.util.HashMap;

/**
 * Serves content:// documents (picked through SAF) to the WebView at
 * https://localhost/_muzean_media/&lt;encodeURIComponent(contentUri)&gt; with real HTTP Range support,
 * so the audio element can stream and seek without loading whole files into memory.
 */
public class MuzeanWebViewClient extends BridgeWebViewClient {

    private final Bridge bridge;

    public MuzeanWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String contentUri = MediaHttp.decodePath(request.getUrl().getEncodedPath());
        if (contentUri != null) {
            try {
                String range = request.getRequestHeaders().get("Range");
                if (range == null) range = request.getRequestHeaders().get("range");
                return MediaServer.serve(bridge.getContext().getContentResolver(), contentUri, range);
            } catch (Exception e) {
                return new WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    404,
                    "Not Found",
                    new HashMap<String, String>(),
                    new ByteArrayInputStream(new byte[0])
                );
            }
        }
        return super.shouldInterceptRequest(view, request);
    }
}
