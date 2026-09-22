import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { SubHeader } from "@/components/AppHeader";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Button, Card, ErrorBox, Screen, TextField } from "@/components/ui";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";

export default function UploadDocumentScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("other");
  const [fileName, setFileName] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickFile() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setFileName(asset.name);
    setContentType(asset.mimeType ?? undefined);
    if (!name) setName(asset.name.replace(/\.[^.]+$/, ""));
    try {
      const data = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setBase64(data);
    } catch {
      setError("Could not read the selected file.");
    }
  }

  async function onSubmit() {
    if (!base64 || !fileName) {
      setError("Pick a file first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await essService.uploadDocument({
        document_type: type.trim() || "other",
        document_name: name.trim() || fileName,
        file_name: fileName,
        content_base64: base64,
        content_type: contentType,
      });
      router.replace("/documents");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll header={<SubHeader title="Upload" />} contentStyle={styles.content}>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Card style={styles.form}>
        <TextField label="Document name" value={name} onChangeText={setName} />
        <TextField
          label="Type (id_proof / contract / other)"
          value={type}
          onChangeText={setType}
          autoCapitalize="none"
        />
        <Button title="Choose file" variant="secondary" onPress={() => void pickFile()} />
        {fileName ? <Text style={styles.file}>Selected: {fileName}</Text> : null}
        <Button title="Upload" loading={loading} onPress={() => void onSubmit()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 12 },
  form: { gap: 12 },
  file: { fontSize: 13, color: colors.onSurfaceVariant },
});
