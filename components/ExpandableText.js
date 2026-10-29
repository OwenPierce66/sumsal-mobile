import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Texto que se corta en `lines` renglones con "Ver más" / "Ver menos".
 * El botón solo aparece si el texto de verdad se pasa: se compara la altura cortada
 * con la de una copia invisible completa (onTextLayout no existe en la web).
 *
 * `renderText(numberOfLines)` dibuja el texto (p. ej. un LinkifiedText).
 * `expanded` / `onToggle` opcionales para controlarlo desde fuera (reels).
 */
const ExpandableText = ({ renderText, lines = 3, expanded: controlled, onToggle, toggleStyle, style }) => {
  const [ownExpanded, setOwnExpanded] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const [fullHeight, setFullHeight] = useState(0);
  const expanded = controlled ?? ownExpanded;
  const overflows = fullHeight > collapsedHeight + 1 && collapsedHeight > 0;
  const toggle = () => (onToggle ? onToggle() : setOwnExpanded((value) => !value));

  return (
    <View style={style}>
      <View onLayout={(e) => { if (!expanded) setCollapsedHeight(e.nativeEvent.layout.height); }}>
        {renderText(expanded ? undefined : lines)}
      </View>
      {/* Copia completa e invisible solo para medir. */}
      <View
        style={styles.measure}
        pointerEvents="none"
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setFullHeight(e.nativeEvent.layout.height)}
      >
        {renderText(undefined)}
      </View>
      {overflows ? (
        <Text
          style={[styles.toggle, toggleStyle]}
          onPress={toggle}
          suppressHighlighting
          accessibilityRole="button"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  toggle: { marginTop: 2, fontSize: 13, fontWeight: '700', color: '#868e96', alignSelf: 'flex-start' },
});

export default ExpandableText;
