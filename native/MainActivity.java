package com.muzean.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MuzeanStoragePlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new MuzeanWebViewClient(getBridge()));
    }
}
