package com.muzean.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "MuzeanStorage")
public class MuzeanStoragePlugin extends Plugin {

    private static final Set<String> AUDIO_EXT = new HashSet<>(
        Arrays.asList("mp3", "flac", "m4a", "aac", "ogg", "oga", "opus", "wav", "wma", "alac", "aif", "aiff", "mka")
    );

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "pickFolderResult");
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri tree = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
            // Some providers do not allow persistable grants; the grant still lasts for this session.
        }
        JSObject ret = new JSObject();
        ret.put("treeUri", tree.toString());
        ret.put("displayName", rootName(getContext().getContentResolver(), tree));
        call.resolve(ret);
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        String treeUri = call.getString("treeUri");
        boolean granted = false;
        if (treeUri != null) {
            for (android.content.UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
                if (p.getUri().toString().equals(treeUri) && p.isReadPermission()) {
                    granted = true;
                    break;
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void scan(final PluginCall call) {
        final String treeUri = call.getString("treeUri");
        if (treeUri == null) {
            call.reject("treeUri is required");
            return;
        }
        new Thread(() -> {
            try {
                ContentResolver cr = getContext().getContentResolver();
                Uri tree = Uri.parse(treeUri);
                String rootDocId = DocumentsContract.getTreeDocumentId(tree);
                String name = rootName(cr, tree);
                JSArray files = new JSArray();
                walk(cr, tree, rootDocId, name, files);
                JSObject ret = new JSObject();
                ret.put("rootName", name);
                ret.put("files", files);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("scan failed: " + e.getMessage());
            }
        }).start();
    }

    private String rootName(ContentResolver cr, Uri tree) {
        Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        try (Cursor c = cr.query(doc, new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) {
                return c.getString(0);
            }
        } catch (Exception ignored) {
            // fall through
        }
        return "Music";
    }

    private void walk(ContentResolver cr, Uri tree, String docId, String relPath, JSArray out) {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        String[] projection = new String[] {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED
        };
        List<String[]> dirs = new ArrayList<>();
        try (Cursor c = cr.query(children, projection, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String id = c.getString(0);
                String name = c.getString(1);
                String mime = c.getString(2);
                long size = c.isNull(3) ? 0L : c.getLong(3);
                long modified = c.isNull(4) ? 0L : c.getLong(4);
                if (id == null || name == null) continue;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    if (!name.startsWith(".")) dirs.add(new String[] { id, name });
                } else if (isAudio(name, mime)) {
                    JSObject o = new JSObject();
                    o.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString());
                    o.put("name", name);
                    o.put("relativePath", relPath + "/" + name);
                    o.put("size", size);
                    o.put("lastModified", modified);
                    o.put("mimeType", mime == null ? "" : mime);
                    out.put(o);
                }
            }
        } catch (Exception ignored) {
            // skip unreadable directory
        }
        for (String[] d : dirs) {
            walk(cr, tree, d[0], relPath + "/" + d[1], out);
        }
    }

    private boolean isAudio(String name, String mime) {
        if (mime != null && mime.startsWith("audio/")) return true;
        int dot = name.lastIndexOf('.');
        if (dot < 0) return false;
        return AUDIO_EXT.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }
}
