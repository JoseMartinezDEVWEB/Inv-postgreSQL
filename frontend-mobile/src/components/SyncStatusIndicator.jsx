import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import syncService from '../services/syncService';
import colors from '../theme/colors';

const SyncStatusIndicator = () => {
  const [status, setStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'
  const [lastSync, setLastSync] = useState(null);
  const spinValue = new Animated.Value(0);
  const opacityValue = new Animated.Value(0);

  useEffect(() => {
    // Suscribirse a eventos de sincronización
    const unsubscribe = syncService.addListener((evento) => {
      if (evento.tipo === 'sync_start' || evento.tipo === 'pull_start' || evento.tipo === 'push_start') {
        setStatus('syncing');
        showIndicator();
      } else if (evento.tipo === 'sync_success' || evento.tipo === 'push_success' || evento.tipo === 'pull_success') {
        setStatus('success');
        setLastSync(new Date());
        // Ocultar después de 3 segundos
        setTimeout(() => {
          hideIndicator();
        }, 3000);
      } else if (evento.tipo === 'sync_error') {
        setStatus('error');
        showIndicator();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (status === 'syncing') {
      startSpinning();
    } else {
      spinValue.stopAnimation();
    }
  }, [status]);

  const startSpinning = () => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const showIndicator = () => {
    Animated.timing(opacityValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideIndicator = () => {
    Animated.timing(opacityValue, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => setStatus('idle'));
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (status === 'idle') return null;

  return (
    <Animated.View style={[styles.container, { opacity: opacityValue }]}>
      <View style={styles.content}>
        {status === 'syncing' && (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync" size={14} color="#fff" />
          </Animated.View>
        )}
        {status === 'success' && (
          <Ionicons name="checkmark-circle" size={14} color={colors.success[500]} />
        )}
        {status === 'error' && (
          <Ionicons name="cloud-offline" size={14} color={colors.danger[500]} />
        )}
        <Text style={styles.text}>
          {status === 'syncing' ? 'Sincronizando...' : 
           status === 'success' ? 'Actualizado' : 
           'Error de conexión'}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default SyncStatusIndicator;
