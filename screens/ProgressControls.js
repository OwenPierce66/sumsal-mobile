import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const formatTime = (millis) => {
    if (!millis) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const clamp = (value) => Math.min(1, Math.max(0, value));

/**
 * Barra de progreso del reel, pegada al borde inferior como en otras redes:
 * una línea delgada que no tapa el video mientras se reproduce. En pausa o al
 * arrastrar se engrosa, muestra el punto y el tiempo. Tocar o arrastrar en
 * cualquier parte de la franja inferior adelanta o regresa el video.
 */
const ProgressControls = ({ status, onSeek, paused }) => {
    const [width, setWidth] = useState(0);
    const [scrubMs, setScrubMs] = useState(null);
    const duration = status.durationMillis || 0;
    const position = scrubMs ?? status.positionMillis ?? 0;
    const fraction = duration ? clamp(position / duration) : 0;
    const expanded = paused || scrubMs !== null;

    // Los hijos no reciben toques (pointerEvents="none"): locationX siempre es relativo a la franja.
    const msAt = (event) => (width ? clamp(event.nativeEvent.locationX / width) * duration : 0);

    return (
        <View
            style={styles.hitArea}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => duration > 0}
            onMoveShouldSetResponder={() => duration > 0}
            // Si el dedo sube o baja, la lista de reels se queda con el gesto (pasar al siguiente reel)
            // y la barra lo suelta sin adelantar; arrastrar de lado sigue adelantando.
            onResponderTerminationRequest={() => true}
            onResponderGrant={(e) => setScrubMs(msAt(e))}
            onResponderMove={(e) => setScrubMs(msAt(e))}
            onResponderRelease={(e) => {
                const target = msAt(e);
                setScrubMs(null);
                onSeek?.(target);
            }}
            onResponderTerminate={() => setScrubMs(null)}
            accessibilityRole="adjustable"
            accessibilityLabel="Progreso del video"
            accessibilityValue={{ min: 0, max: Math.round(duration / 1000), now: Math.round(position / 1000) }}
        >
            {expanded ? (
                <Text style={styles.time} pointerEvents="none">
                    {formatTime(position)} / {formatTime(duration)}
                </Text>
            ) : null}
            <View style={[styles.track, expanded && styles.trackExpanded]} pointerEvents="none">
                <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
            </View>
            {expanded ? (
                <View
                    pointerEvents="none"
                    style={[styles.thumb, { left: Math.min(Math.max(0, fraction * width - THUMB / 2), Math.max(0, width - THUMB)) }]}
                />
            ) : null}
        </View>
    );
};

const THUMB = 12;

const textShadow = Platform.select({
    web: { textShadow: '0px 1px 2px rgba(0,0,0,0.8)' },
    default: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});

const styles = StyleSheet.create({
    // Franja táctil más alta que la línea visible, para atinarle fácil.
    hitArea: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 22,
        justifyContent: 'flex-end',
        // Por encima de todo el reel (información, iconos y la animación del like).
        zIndex: 1000,
        elevation: 1000,
        ...Platform.select({ web: { cursor: 'pointer' }, default: {} }),
    },
    track: { height: 3, width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.25)' },
    // Con el círculo visible la línea sube un poco para que el círculo no se corte en el borde.
    trackExpanded: { height: 5, marginBottom: (THUMB - 5) / 2 },
    fill: { height: '100%', backgroundColor: '#fff' },
    thumb: {
        position: 'absolute',
        bottom: 0,
        zIndex: 1,
        ...Platform.select({
            web: { boxShadow: '0px 0px 4px rgba(0,0,0,0.6)' },
            default: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
        }),
        width: THUMB,
        height: THUMB,
        borderRadius: THUMB / 2,
        backgroundColor: '#fff',
    },
    time: {
        position: 'absolute',
        right: 12,
        bottom: 10,
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        ...textShadow,
    },
});

export default ProgressControls;
