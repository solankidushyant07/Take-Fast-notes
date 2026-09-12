package com.coconutshell.flashnotes;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(
        name = "FlashNotesVault"
)
public class VaultPlugin extends Plugin {

    private static final String PREFS =
            "tfn_native";

    private static final int AUTH =
            702;

    private PluginCall authCall;

    private SharedPreferences prefs() {
        return getContext()
                .getSharedPreferences(
                        PREFS,
                        Context.MODE_PRIVATE
                );
    }

    @PluginMethod
    public void authenticate(
            PluginCall call
    ) {
        KeyguardManager manager =
                (KeyguardManager)
                        getContext()
                                .getSystemService(
                                        Context.KEYGUARD_SERVICE
                                );

        if (
                manager == null ||
                !manager.isKeyguardSecure()
        ) {
            call.reject(
                    "No device security is configured"
            );

            return;
        }

        Intent intent =
                manager.createConfirmDeviceCredentialIntent(
                        "Flash Notes",
                        "Authenticate to continue"
                );

        if (intent == null) {
            call.reject(
                    "Authentication unavailable"
            );

            return;
        }

        authCall = call;

        startActivityForResult(
                call,
                intent,
                AUTH
        );
    }

    @PluginMethod
    public void getPendingShare(
            PluginCall call
    ) {
        SharedPreferences prefs =
                prefs();

        String text =
                prefs.getString(
                        "share_text",
                        null
                );

        String subject =
                prefs.getString(
                        "share_subject",
                        ""
                );

        String action =
                prefs.getString(
                        "launch_action",
                        null
                );

        JSObject result =
                new JSObject();

        if (text != null) {
            result.put(
                    "text",
                    text
            );

            result.put(
                    "subject",
                    subject
            );

            prefs.edit()
                    .remove(
                            "share_text"
                    )
                    .remove(
                            "share_subject"
                    )
                    .apply();
        }

        if (action != null) {
            result.put(
                    "action",
                    action
            );

            prefs.edit()
                    .remove(
                            "launch_action"
                    )
                    .apply();
        }

        call.resolve(
                result
        );
    }

    @Override
    protected void handleOnActivityResult(
            int requestCode,
            int resultCode,
            Intent data
    ) {
        super.handleOnActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (
                requestCode == AUTH &&
                authCall != null
        ) {
            if (
                    resultCode ==
                    Activity.RESULT_OK
            ) {
                authCall.resolve();
            } else {
                authCall.reject(
                        "Authentication cancelled"
                );
            }

            authCall = null;
        }
    }
}
