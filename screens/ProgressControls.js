import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Slider from '@react-native-community/slider';

const formatTime = (millis) => {
    if (!millis) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const ProgressControls = ({ status, onSeek }) => (
    <View style={styles.progressContainer}>
        <Slider style={styles.progressBar} minimumValue={0} maximumValue={status.durationMillis || 1} value={status.positionMillis || 0} onSlidingComplete={onSeek} minimumTrackTintColor="#fff" maximumTrackTintColor="rgba(255, 255, 255, 0.3)" thumbTintColor="#fff" />
        <Text style={styles.progressText}>{formatTime(status.positionMillis)} / {formatTime(status.durationMillis)}</Text>
    </View>
);

const styles = StyleSheet.create({
    progressContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 95 : 75, left: 15, right: 15, zIndex: 20, pointerEvents: 'box-auto' },
    progressBar: { width: '100%', height: 20 },
    // ✅ CORRECCIÓN: Se usa la sintaxis correcta para textShadow en React Native
    progressText: { position: 'absolute', right: 5, top: 15, color: '#fff', fontSize: 11, fontWeight: 'bold', 
        textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 4, borderRadius: 4, pointerEvents: 'none' 
    },
});

export default ProgressControls;