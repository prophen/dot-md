import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center px-4">
      <title>{`Not found · ${APP_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <h1 className="mb-2 font-serif text-4xl font-semibold text-foreground">404</h1>
      <p className="mb-6 text-muted-foreground">No such file or directory</p>
      <Link
        to="/people"
        className="border border-foreground px-3 py-1.5 text-[12.5px] hover:bg-foreground hover:text-background"
      >
        Back to ~/people
      </Link>
    </div>
  )
}
