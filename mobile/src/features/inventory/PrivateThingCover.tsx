import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { premiumColors } from '../../lib/premiumTheme';
import { useRemoteImageState } from '../../lib/useRemoteImageState';

type Props = {
  uri?: string | null;
  fallbackLabel: string;
  size?: number;
  borderRadius?: number;
  accessibilityLabel?: string;
};

function PrivateThingCoverComponent({
  uri,
  fallbackLabel,
  size = 64,
  borderRadius = 18,
  accessibilityLabel,
}: Props) {
  const image = useRemoteImageState(uri);
  const initial = fallbackLabel.trim().slice(0, 1).toUpperCase() || 'T';
  const frameStyle = useMemo(() => ({ width: size, height: size, borderRadius }), [borderRadius, size]);

  if (image.source && !image.failed) {
    return (
      <View style={[styles.frame, frameStyle]}>
        <Image
          key={uri || 'private-cover'}
          source={image.source}
          style={styles.image}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={0}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel ?? `${fallbackLabel} photo`}
          onLoadStart={image.onLoadStart}
          onLoadEnd={image.onLoadEnd}
          onError={image.onError}
        />
        {image.loading ? (
          <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.loadingOverlay}>
            <ActivityIndicator accessibilityElementsHidden />
          </View>
        ) : null}
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

export const PrivateThingCover = memo(PrivateThingCoverComponent);

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: premiumColors.imagePlaceholder,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumColors.imagePlaceholder,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: premiumColors.imagePlaceholderBorder,
  },
  initial: {
    color: premiumColors.imagePlaceholderText,
    fontSize: 20,
    fontWeight: '800',
  },
});
