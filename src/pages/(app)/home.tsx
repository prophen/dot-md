/** Sign-in lands on /home; the directory is the app's home. */

import { Navigate } from 'react-router-dom'

export default function HomePage() {
  return <Navigate to="/people" replace />
}
