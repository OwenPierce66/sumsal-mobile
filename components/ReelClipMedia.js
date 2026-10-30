/**
 * components/ReelClipMedia.js
 *
 * Un clip del reel: llena la pantalla si su forma se parece a la de la pantalla; si no
 * (p. ej. una foto o video horizontal), se ve completo: la foto con una copia desenfocada
 * detrás y el video sobre negro.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
import { fillsBox, imageSizeFromLoad, useMediaRatio, videoSizeFromReady } from '../utils/mediaLayout';

const ReelClipMedia = ({ type, uri, boxRatio, videoRef, videoProps }) => {
  const [ratio, onSize] = useMediaRatio(uri);
  const fill = fillsBox(ratio, boxRatio);
  if (type === 'image') {
    return (
      <>
        {fill ? null : (
          <>
            <Image source={{ uri }} style={styles.media} contentFit="cover" blurRadius={40} />
            <View style={styles.backdropShade} />
          </>
        )}
        <Image
          source={{ uri }}
          style={styles.media}
          contentFit={fill ? 'cover' : 'contain'}
          onLoad={(event) => onSize(imageSizeFromLoad(event))}
        />
      </>
    );
  }
  return (
    <Video
      ref={videoRef}
      source={{ uri }}
      style={[styles.media, styles.video]}
      resizeMode={fill ? 'cover' : 'contain'}
      onReadyForDisplay={(event) => onSize(videoSizeFromReady(event))}
      {...videoProps}
    />
  );
};

const styles = StyleSheet.create({
  media: { ...StyleSheet.absoluteFillObject },
  video: { backgroundColor: '#000' },
  backdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
});

export default ReelClipMedia;
