# Gymnastics Graphics Show Controller

Frontend application for managing gymnastics broadcast production.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Netlify Deployment

The show controller is deployed to Netlify at `commentarygraphic.com`.

### Serverless Functions

The application includes Netlify Functions for managing the coordinator EC2 instance:

- `wake-coordinator.js` - Starts the coordinator when the system is sleeping
- `coordinator-status.js` - Checks coordinator EC2 state and application health

### Required Netlify Environment Variables

Configure these environment variables in the Netlify dashboard under **Site Settings > Environment Variables**:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `COORDINATOR_AWS_ACCESS_KEY_ID` | IAM user access key for `netlify-coordinator-control` | `AKIA...` |
| `COORDINATOR_AWS_SECRET_ACCESS_KEY` | IAM user secret key | `wJal...` |
| `COORDINATOR_AWS_REGION` | AWS region where coordinator runs | `us-east-1` |
| `COORDINATOR_INSTANCE_ID` | EC2 instance ID of the coordinator | `i-001383a4293522fa4` |

**Note:** These variables are already configured in the production Netlify site.

### IAM User: netlify-coordinator-control

A dedicated IAM user with minimal permissions for the Netlify functions:

**Policy Name:** `netlify-coordinator-control-policy`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeInstances"
      ],
      "Resource": "arn:aws:ec2:us-east-1:*:instance/i-001383a4293522fa4"
    },
    {
      "Effect": "Allow",
      "Action": "ec2:DescribeInstances",
      "Resource": "*"
    }
  ]
}
```

This policy follows the principle of least privilege:
- Can only start/stop the specific coordinator instance
- Has read-only access to describe any instance (required for status checks)
- Cannot launch, terminate, or modify instances

## Local Development

For local development, the frontend connects to a local server:

```bash
# In server/ directory
npm run dev

# In show-controller/ directory (separate terminal)
npm run dev
```

Navigate to `http://localhost:5173/local/producer` for local development mode.
