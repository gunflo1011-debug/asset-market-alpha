import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  uri?: string | null;
  fallbackLabel: string;
  size?: number;
  borderRadius?: number;
  accessibilityLabel?: string;
};

export function PrivateThingCover({
  uri,
  fallbackLabel,
  size = 64,
  borderRadius = 18,
  accessibilityLabel,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = fallbackLabel.trim().slice(0, 1).toUpperCase() || 'T';
  const frameStyle = { width: size, height: size, borderRadius };

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  if (uri && !imageFailed) {
    return (
      <View style={[styles.frame, frameStyle]}>
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel ?? `${fallbackLabel} photo`}
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${fallbackLabel} photo placeholder`}
      style={[styles.frame, styles.placeholder, frameStyle]}
    >
      <Text style={styles.initial}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: '#EEF2F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  initial: {
    color: '#536074',
    fontSize: 20,
    fontWeight: '800',
  },
});
