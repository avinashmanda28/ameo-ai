import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/governance/audit — List audit logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const ruleId = searchParams.get('ruleId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const auditLogs = await db.auditLog.findMany({
      where: {
        ...(severity && { severity }),
        ...(ruleId && { ruleId }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })

    return NextResponse.json({ success: true, data: auditLogs })
  } catch (error) {
    console.error('[GET /api/governance/audit]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

// POST /api/governance/audit — Create an audit log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, ruleId, agentId, action, resource, severity, details, approved } = body

    if (!workspaceId || !action) {
      return NextResponse.json(
        { success: false, error: 'workspaceId and action are required' },
        { status: 400 }
      )
    }

    const validSeverities = ['info', 'warn', 'error', 'critical']
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        { success: false, error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      )
    }

    const auditLog = await db.auditLog.create({
      data: {
        workspaceId,
        action,
        ...(ruleId && { ruleId }),
        ...(agentId && { agentId }),
        ...(resource && { resource }),
        ...(severity && { severity }),
        ...(details && { details: typeof details === 'string' ? details : JSON.stringify(details) }),
        ...(approved !== undefined && { approved }),
      },
    })

    return NextResponse.json({ success: true, data: auditLog }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/governance/audit]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create audit log' },
      { status: 500 }
    )
  }
}
