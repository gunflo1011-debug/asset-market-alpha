import React, { memo } from 'react';
import { ActivityIndicator, Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { premiumColors } from '../../lib/premiumTheme';
import { useRemoteImageState } from '../../lib/useRemoteImageState';

type Props = {
  uri?: string | null;
  accessibilityLabel: string;
  style: StyleProp<ViewStyle>;
  fallbackLabel?: string;
};

function PublicListingImageComponent({
  uri,
  accessibilityLabel,
  style,
  fallbackLabel = 'Public photo unavailable',
}: Props) {
  const image = useRemoteImageState(uri);

  if (image.source && !image.failed) {
    return (
      <View style={[styles.frame, style]}>
        <Image
          key={uri || 'public-listing-image'}
          source={image.source}
          style={styles.image}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={0}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
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
      accessibilityLabel={`${accessibilityLabel}. ${fallbackLabel}`}
      style={[styles.frame, styles.placeholder, style]}
    >
      <Text style={styles.placeholderEyebrow}>PHOTO</Text>
      <Text style={styles.placeholderText}>{fallbackLabel}</Text>
    </View>
  );
}

export const PublicListingImage = memo(PublicListingImageComponent);

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
    paddingHorizontal: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: premiumColors.imagePlaceholderBorder,
  },
  placeholderEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: premiumColors.textSubtle,
  },
  placeholderText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: premiumColors.imagePlaceholderText,
  },
});
