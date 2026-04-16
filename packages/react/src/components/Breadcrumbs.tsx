import React from 'react'
import type { BreadcrumbEntry, BreadcrumbTheme } from 'system-canvas'

interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbEntry[]
  theme: BreadcrumbTheme
  onNavigate: (index: number) => void
}

export function Breadcrumbs({
  breadcrumbs,
  theme,
  onNavigate,
}: BreadcrumbsProps) {
  if (breadcrumbs.length <= 1) return null

  return (
    <div
      className="system-canvas-breadcrumbs"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 12px',
        background: theme.background,
        borderRadius: 8,
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
      }}
    >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <span
                style={{
                  color: theme.separatorColor,
                  margin: '0 2px',
                }}
              >
                /
              </span>
            )}
            <span
              onClick={isLast ? undefined : () => onNavigate(index)}
              style={{
                color: isLast ? theme.activeColor : theme.textColor,
                cursor: isLast ? 'default' : 'pointer',
                fontWeight: isLast ? 600 : 400,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isLast) {
                  ;(e.target as HTMLElement).style.color = theme.activeColor
                }
              }}
              onMouseLeave={(e) => {
                if (!isLast) {
                  ;(e.target as HTMLElement).style.color = theme.textColor
                }
              }}
            >
              {crumb.label}
            </span>
          </React.Fragment>
        )
      })}
    </div>
  )
}
