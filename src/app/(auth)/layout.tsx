export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Ameo AI</h1>
          <p className="text-muted-foreground mt-2">Governed AI-Native Operational Platform</p>
        </div>
        {children}
      </div>
    </div>
  )
}
