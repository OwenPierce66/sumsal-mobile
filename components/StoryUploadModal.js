import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, Platform, StyleSheet, Image as RNImage,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import api, { UPLOAD_TIMEOUT_MS } from '@api';

const getExtensionFromMime = (mimeType, fallback = 'bin') => {
  if (!mimeType) return fallback;
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  return fallback;
};

const looksLikeVideoName = (name) => {
  if (!name) return false;
  return /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(String(name));
};

const isLikelyVideoFile = (file, fallbackType, uri) => {
  const mime = file?.type || '';
  const name = file?.name || '';
  const rawUri = String(uri || '').toLowerCase();
  const uriLooksVideo =
    rawUri.startsWith('data:video/')
    || rawUri.includes('video/mp4')
    || rawUri.includes('video/webm')
    || /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(rawUri);
  return mime.startsWith('video/') || looksLikeVideoName(name) || uriLooksVideo || fallbackType === 'video';
};

/**
 * Modal para publicar una historia (24h). Es autónomo: elige imagen/video, escribe el texto
 * y hace POST a `stories/`. Se usa tanto en el feed (StoriesBar) como en Stories24hScreen.
 */
const StoryUploadModal = ({ visible, onClose, onUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadUri, setUploadUri] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadError, setUploadError] = useState('');

  const revokeBlob = useCallback((uri) => {
    if (Platform.OS === 'web' && uri && uri.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(uri);
      } catch (error) {}
    }
  }, []);

  const resetUploadState = useCallback(() => {
    revokeBlob(uploadUri);
    setUploadUri(null);
    setUploadFile(null);
    setUploadType(null);
    setUploadCaption('');
    setUploadError('');
  }, [uploadUri, revokeBlob]);

  useEffect(() => () => revokeBlob(uploadUri), [uploadUri, revokeBlob]);

  const isUploadVideo = useMemo(
    () => isLikelyVideoFile(uploadFile, uploadType, uploadUri),
    [uploadFile, uploadType, uploadUri]
  );

  const handleClose = useCallback(() => {
    if (uploading) return;
    resetUploadState();
    onClose?.();
  }, [uploading, resetUploadState, onClose]);

  const pickStoryMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: Platform.OS !== 'web',
      quality: 0.8,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    revokeBlob(uploadUri);

    const pickedFile = asset.file || null;
    const pickedMimeType = pickedFile?.type || '';
    const assetMimeType = asset.mimeType || '';
    const filenameHint = `${asset.fileName || pickedFile?.name || ''}`.toLowerCase();
    const mediaType = (
      asset.type === 'video'
      || assetMimeType.startsWith('video/')
      || pickedMimeType.startsWith('video/')
      || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(filenameHint)
      || (typeof asset.duration === 'number' && asset.duration > 0)
      || String(asset.uri || '').toLowerCase().startsWith('data:video/')
    ) ? 'video' : 'image';

    const previewUri = (Platform.OS === 'web' && pickedFile)
      ? URL.createObjectURL(pickedFile)
      : asset.uri;

    setUploadUri(previewUri);
    setUploadFile(pickedFile);
    setUploadType(mediaType);
  }, [uploadUri, revokeBlob]);

  const submitStory = useCallback(async () => {
    if (!uploadUri || !uploadType) {
      setUploadError('Selecciona una imagen o video.');
      return;
    }

    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('caption', uploadCaption.trim());

    try {
      if (Platform.OS === 'web') {
        const blob = uploadFile || (await (await fetch(uploadUri)).blob());
        const blobMimeType = blob?.type || '';
        const originalName = uploadFile?.name || '';
        const isVideoBlob = isLikelyVideoFile({ type: blobMimeType, name: originalName }, uploadType, uploadUri);

        const fieldName = isVideoBlob ? 'video' : 'image';
        const fallbackExtension = isVideoBlob ? 'mp4' : 'jpg';
        const extension = getExtensionFromMime(blobMimeType, fallbackExtension);
        const filename = uploadFile?.name || `story.${extension}`;
        formData.append(fieldName, blob, filename);
      } else {
        const extension = uploadType === 'video' ? 'mp4' : 'jpg';
        const mimeType = uploadType === 'video' ? 'video/mp4' : 'image/jpeg';
        const fieldName = uploadType === 'video' ? 'video' : 'image';
        formData.append(fieldName, {
          uri: uploadUri,
          name: `story.${extension}`,
          type: mimeType,
        });
      }

      await api.post('stories/', formData, { timeout: UPLOAD_TIMEOUT_MS });
      resetUploadState();
      onClose?.();
      onUploaded?.();
    } catch (error) {
      const backendError =
        error?.response?.data?.caption
        || error?.response?.data?.image
        || error?.response?.data?.video
        || error?.response?.data?.detail
        || error?.response?.data?.error;
      setUploadError(
        Array.isArray(backendError)
          ? backendError.join(', ')
          : (backendError || 'No se pudo subir la historia.')
      );
    } finally {
      setUploading(false);
    }
  }, [uploadUri, uploadFile, uploadType, uploadCaption, resetUploadState, onClose, onUploaded]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.uploadOverlay}>
        <View style={styles.uploadModal}>
          <View style={styles.uploadHeader}>
            <Text style={styles.uploadTitle}>Subir historia (24h)</Text>
            <TouchableOpacity disabled={uploading} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.uploadPicker} onPress={pickStoryMedia} disabled={uploading}>
            {uploadUri ? (
              isUploadVideo ? (
                Platform.OS === 'web' ? (
                  <video
                    src={uploadUri}
                    controls
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                  />
                ) : (
                  <Video source={{ uri: uploadUri }} style={styles.uploadPreview} useNativeControls resizeMode="contain" />
                )
              ) : (
                <RNImage source={{ uri: uploadUri }} style={styles.uploadPreview} resizeMode="cover" />
              )
            ) : (
              <Text style={styles.uploadPlaceholder}>Selecciona una imagen o video</Text>
            )}
          </TouchableOpacity>

          <TextInput
            value={uploadCaption}
            onChangeText={setUploadCaption}
            placeholder="Texto (opcional)"
            placeholderTextColor="#999"
            multiline
            editable={!uploading}
            style={styles.uploadInput}
          />

          {!!uploadError && <Text style={styles.uploadError}>{uploadError}</Text>}

          <View style={styles.uploadActions}>
            <TouchableOpacity disabled={uploading} style={styles.uploadCancel} onPress={handleClose}>
              <Text style={styles.uploadCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={uploading} style={styles.uploadSubmit} onPress={submitStory}>
              <Text style={styles.uploadSubmitText}>{uploading ? 'Subiendo…' : 'Publicar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  uploadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', padding: 14 },
  uploadModal: { backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  uploadHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#232323',
  },
  uploadTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  uploadPicker: {
    margin: 14, height: 240, borderRadius: 12, borderWidth: 1, borderColor: '#333',
    backgroundColor: '#060606', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  uploadPreview: { width: '100%', height: '100%' },
  uploadPlaceholder: { color: '#aaa', fontSize: 13 },
  uploadInput: {
    marginHorizontal: 14, marginBottom: 10, minHeight: 80, borderRadius: 10, borderWidth: 1,
    borderColor: '#333', paddingHorizontal: 10, paddingVertical: 10, color: '#fff',
    backgroundColor: '#181818', textAlignVertical: 'top',
  },
  uploadError: { color: '#ff8f8f', marginHorizontal: 14, marginBottom: 8, fontSize: 12 },
  uploadActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 14,
    borderTopWidth: 1, borderTopColor: '#232323',
  },
  uploadCancel: { backgroundColor: '#212121', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  uploadCancelText: { color: '#fff', fontWeight: '600' },
  uploadSubmit: { backgroundColor: '#4dabf7', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  uploadSubmitText: { color: '#fff', fontWeight: '700' },
});

export default StoryUploadModal;
