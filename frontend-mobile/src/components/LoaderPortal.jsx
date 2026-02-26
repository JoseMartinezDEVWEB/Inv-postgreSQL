import React from 'react'
import { Modal } from 'react-native'
import { useLoader } from '../context/LoaderContext'
import SplashScreen from './SplashScreen'

const LoaderPortal = () => {
  const { visible, durationMs, variant, message } = useLoader()
  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <SplashScreen onComplete={() => {}} durationMs={durationMs} variant={variant} message={message} />
    </Modal>
  )
}

export default LoaderPortal
