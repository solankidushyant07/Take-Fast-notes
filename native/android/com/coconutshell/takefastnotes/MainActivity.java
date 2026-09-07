package com.coconutshell.takefastnotes;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.util.Arrays;

public class MainActivity extends BridgeActivity {

    private static final String PREFS =
            "tfn_native";

    private static final String SHARE_TEXT =
            "share_text";

    private static final String SHARE_SUBJECT =
            "share_subject";

    private static final String ACTION =
            "launch_action";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(
                VaultPlugin.class
        );

        super.onCreate(
                savedInstanceState
        );

        captureIntent(
                getIntent()
        );

        installShortcuts();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        setIntent(intent);

        captureIntent(intent);
    }

    private void captureIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        SharedPreferences prefs =
                getSharedPreferences(
                        PREFS,
                        MODE_PRIVATE
                );

        String action =
                intent.getStringExtra(
                        "tfn_action"
                );

        if (
                "search".equals(action) ||
                "new".equals(action)
        ) {
            prefs.edit()
                    .putString(
                            ACTION,
                            action
                    )
                    .apply();

            if (getBridge() != null) {
                com.getcapacitor.JSObject data =
                        new com.getcapacitor.JSObject();

                data.put(
                        "action",
                        action
                );

                getBridge()
                        .triggerWindowJSEvent(
                                "tfn-launch-action",
                                data.toString()
                        );
            }
        }

        if (
                Intent.ACTION_SEND.equals(
                        intent.getAction()
                )
        ) {
            CharSequence text =
                    intent.getCharSequenceExtra(
                            Intent.EXTRA_TEXT
                    );

            if (
                    text != null &&
                    text.length() > 0
            ) {
                String subject =
                        intent.getStringExtra(
                                Intent.EXTRA_SUBJECT
                        );

                if (subject == null) {
                    subject = "";
                }

                prefs.edit()
                        .putString(
                                SHARE_TEXT,
                                text.toString()
                        )
                        .putString(
                                SHARE_SUBJECT,
                                subject
                        )
                        .apply();

                if (getBridge() != null) {
                    com.getcapacitor.JSObject data =
                            new com.getcapacitor.JSObject();

                    data.put(
                            "text",
                            text.toString()
                    );

                    data.put(
                            "subject",
                            subject
                    );

                    getBridge()
                            .triggerWindowJSEvent(
                                    "tfn-share-received",
                                    data.toString()
                            );
                }
            }
        }
    }

    private void installShortcuts() {
        if (
                android.os.Build.VERSION.SDK_INT < 25
        ) {
            return;
        }

        ShortcutManager manager =
                getSystemService(
                        ShortcutManager.class
                );

        if (manager == null) {
            return;
        }

        Intent searchIntent =
                new Intent(
                        this,
                        MainActivity.class
                )
                        .setAction(
                                Intent.ACTION_VIEW
                        )
                        .putExtra(
                                "tfn_action",
                                "search"
                        );

        Intent newNoteIntent =
                new Intent(
                        this,
                        MainActivity.class
                )
                        .setAction(
                                Intent.ACTION_VIEW
                        )
                        .putExtra(
                                "tfn_action",
                                "new"
                        );

        ShortcutInfo search =
                new ShortcutInfo.Builder(
                        this,
                        "search"
                )
                        .setShortLabel(
                                "Search"
                        )
                        .setLongLabel(
                                "Search notes"
                        )
                        .setIcon(
                                Icon.createWithResource(
                                        this,
                                        android.R.drawable.ic_menu_search
                                )
                        )
                        .setIntent(
                                searchIntent
                        )
                        .build();

        ShortcutInfo newNote =
                new ShortcutInfo.Builder(
                        this,
                        "new_note"
                )
                        .setShortLabel(
                                "New note"
                        )
                        .setLongLabel(
                                "Create a new note"
                        )
                        .setIcon(
                                Icon.createWithResource(
                                        this,
                                        android.R.drawable.ic_input_add
                                )
                        )
                        .setIntent(
                                newNoteIntent
                        )
                        .build();

        manager.setDynamicShortcuts(
                Arrays.asList(
                        search,
                        newNote
                )
        );
    }
}
