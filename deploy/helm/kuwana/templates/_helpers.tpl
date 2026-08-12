{{/*
Name helpers — the standard Helm forms, kept so labels stay stable across
renames and so nothing exceeds the 63-character limit on a label value.
*/}}
{{- define "kuwana.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "kuwana.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "kuwana.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels, deliberately without app.kubernetes.io/component: each resource
adds its own (web / migrate / cron / postgres). Putting a component in here
would collide with those and emit a duplicate YAML key.
*/}}
{{- define "kuwana.labels" -}}
helm.sh/chart: {{ include "kuwana.chart" . }}
app.kubernetes.io/name: {{ include "kuwana.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: kuwana
{{- end -}}

{{/*
Selector labels for the web Deployment. Immutable once applied — anything that
changes between releases (version, chart) must stay out of this block.
*/}}
{{- define "kuwana.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kuwana.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: web
{{- end -}}

{{- define "kuwana.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "kuwana.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Image reference. A digest wins over a tag when both are set: it is the only
form that guarantees the bytes running in production are the bytes that were
scanned and signed.
*/}}
{{- define "kuwana.image" -}}
{{- if .Values.image.digest -}}
{{- printf "%s@%s" .Values.image.repository .Values.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) -}}
{{- end -}}
{{- end -}}

{{- define "kuwana.migrationsImage" -}}
{{- if .Values.migrations.image.digest -}}
{{- printf "%s@%s" .Values.migrations.image.repository .Values.migrations.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.migrations.image.repository (default .Chart.AppVersion .Values.migrations.image.tag) -}}
{{- end -}}
{{- end -}}

{{/*
Name of the Secret holding the application's runtime secrets, whichever of the
three supported sources produced it.
*/}}
{{- define "kuwana.secretName" -}}
{{- if .Values.existingSecret -}}
{{- .Values.existingSecret -}}
{{- else -}}
{{- include "kuwana.fullname" . -}}
{{- end -}}
{{- end -}}

{{- define "kuwana.postgresFullname" -}}
{{- printf "%s-postgres" (include "kuwana.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "kuwana.valkeyFullname" -}}
{{- printf "%s-valkey" (include "kuwana.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
REDIS_URL, when a shared store exists at all. Unset, the app falls back to
per-pod in-memory caching and per-pod rate limiting — correct for a single
replica, and quietly wrong above one, which is why the readiness probe reports
the store's absence rather than staying silent about it.
*/}}
{{- define "kuwana.redisEnv" -}}
{{- if .Values.valkey.enabled }}
- name: REDIS_URL
  valueFrom:
    secretKeyRef:
      name: {{ default (include "kuwana.valkeyFullname" .) .Values.valkey.auth.existingSecret }}
      key: redis-url
{{- else if .Values.externalRedis.enabled }}
- name: REDIS_URL
  valueFrom:
    secretKeyRef:
      name: {{ required "externalRedis.existingSecret is required when externalRedis.enabled=true" .Values.externalRedis.existingSecret }}
      key: {{ .Values.externalRedis.secretKey }}
{{- end }}
{{- end -}}

{{/*
Where DATABASE_URL comes from. With the in-cluster Postgres enabled the chart
composes the URL itself, so nothing has to hand-maintain a connection string
that points at a Service this same chart named.
*/}}
{{- define "kuwana.databaseUrlSecretName" -}}
{{- if .Values.postgresql.enabled -}}
{{- include "kuwana.postgresFullname" . -}}
{{- else -}}
{{- include "kuwana.secretName" . -}}
{{- end -}}
{{- end -}}

{{- define "kuwana.databaseUrlSecretKey" -}}
{{- if .Values.postgresql.enabled -}}database-url{{- else -}}DATABASE_URL{{- end -}}
{{- end -}}

{{/*
The environment block shared by the web Deployment and the migration Job, so
the two can never drift into pointing at different databases.
*/}}
{{- define "kuwana.databaseEnv" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "kuwana.databaseUrlSecretName" . }}
      key: {{ include "kuwana.databaseUrlSecretKey" . }}
{{- end -}}

{{/*
Fails the render — loudly, at `helm template` time rather than as a CrashLoop
twenty minutes later — when a release has no way to obtain its secrets.
*/}}
{{- define "kuwana.validate" -}}
{{- if and (not .Values.existingSecret) (not .Values.secrets.create) (not .Values.externalSecret.enabled) -}}
{{- fail "No secret source configured: set one of externalSecret.enabled=true (preferred), existingSecret=<name>, or secrets.create=true (dev only)." -}}
{{- end -}}
{{- if and .Values.secrets.create .Values.externalSecret.enabled -}}
{{- fail "secrets.create and externalSecret.enabled are mutually exclusive — both would write the same Secret name." -}}
{{- end -}}
{{- if and .Values.valkey.enabled .Values.externalRedis.enabled -}}
{{- fail "valkey.enabled and externalRedis.enabled are mutually exclusive — pick one source for REDIS_URL." -}}
{{- end -}}
{{/*
Refuses to scale past one replica without a shared store. This is the failure
this whole component exists to prevent, and it is invisible at runtime: the app
serves happily while silently ignoring cache invalidations and multiplying its
own rate limits by the replica count.
*/}}
{{- if and .Values.keda.enabled .Values.autoscaling.enabled -}}
{{- fail "keda.enabled and autoscaling.enabled are mutually exclusive — a KEDA ScaledObject creates its own HPA, and two HPAs on one Deployment fight over the replica count." -}}
{{- end -}}
{{- $replicas := 1 -}}
{{- if .Values.keda.enabled -}}
{{- $replicas = int .Values.keda.maxReplicaCount -}}
{{- else if .Values.autoscaling.enabled -}}
{{- $replicas = int .Values.autoscaling.maxReplicas -}}
{{- else -}}
{{- $replicas = int .Values.replicaCount -}}
{{- end -}}
{{- if and (gt $replicas 1) (not .Values.valkey.enabled) (not .Values.externalRedis.enabled) -}}
{{- fail "More than one replica without a shared cache: enable valkey.enabled or externalRedis.enabled, or pin to a single replica. Without one, revalidateTag reaches only the pod that served the write and the rate limiter permits limit x replicas." -}}
{{- end -}}
{{/*
Connection budget. Checked here because the failure mode is indistinguishable
from a total outage — Postgres starts refusing connections, every pod 500s,
and nothing in the logs says "you asked for more connections than exist".
Two spare are reserved for the migration Job and any admin psql session.
*/}}
{{- if .Values.postgresql.enabled -}}
{{- $budget := add (mul $replicas (int .Values.database.connectionLimit)) 2 -}}
{{- if gt $budget (int .Values.postgresql.maxConnections) -}}
{{- fail (printf "Connection budget exceeded: %d replicas x connection_limit %d + 2 = %d, but postgresql.maxConnections is %d. Lower database.connectionLimit, lower the replica ceiling, or raise postgresql.maxConnections." $replicas (int .Values.database.connectionLimit) $budget (int .Values.postgresql.maxConnections)) -}}
{{- end -}}
{{- end -}}
{{- end -}}
