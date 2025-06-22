# RBAC (Role-Based Access Control) Implementation

This document explains how to use the new RBAC middleware system that allows you to protect controller methods with a single line of code.

## Features

- ✅ **One line of code** at the top of controller functions
- ✅ **Type safety** with TypeScript
- ✅ **Follows existing code patterns**
- ✅ **Granular control** per method
- ✅ **Easy to understand and maintain**
- ✅ **Consistent error responses**
- ✅ **Multiple usage patterns** for flexibility

## Available Roles

Based on your Prisma schema:

```typescript
enum Role {
  super_admin
  admin
  user
}
```

## Basic Usage

### 1. Import the RBAC decorators

```typescript
import { requireRole, requireAdmin, requireSuperAdmin, requireUser } from "../middleware/rbac";
import { AuthRequest } from "../middleware/verifyToken";
```

### 2. Apply to controller methods

```typescript
// Method 1: Direct role specification
const adminOnlyMethod = requireRole([Role.admin, Role.super_admin])(async (
	req: AuthRequest,
	res: Response,
	_next: NextFunction,
) => {
	// Your controller logic here
});

// Method 2: Using convenience decorators
const superAdminMethod = requireSuperAdmin(
	async (req: AuthRequest, res: Response, _next: NextFunction) => {
		// Only super_admin can access
	},
);

const userMethod = requireUser(async (req: AuthRequest, res: Response, _next: NextFunction) => {
	// user, admin, and super_admin can access
});

const adminMethod = requireAdmin(async (req: AuthRequest, res: Response, _next: NextFunction) => {
	// admin and super_admin can access
});
```

## Available Decorators

### Core Functions

| Function               | Description               | Allowed Roles                  |
| ---------------------- | ------------------------- | ------------------------------ |
| `requireRole([roles])` | Custom role specification | As specified                   |
| `requireUser`          | Standard user access      | `user`, `admin`, `super_admin` |
| `requireAdmin`         | Admin-level access        | `admin`, `super_admin`         |
| `requireSuperAdmin`    | Super admin only          | `super_admin`                  |
| `requireAnyRole`       | Any authenticated user    | `user`, `admin`, `super_admin` |

### Advanced Functions

- `protectController(controller, protections)` - Apply protection to entire controller objects

## Practical Example

Here's how to protect a user controller:

```typescript
import { Request, Response, NextFunction } from "express";
import { PrismaClient, Role } from "../generated/prisma";
import { AuthRequest } from "../middleware/verifyToken";
import { requireRole, requireAdmin, requireSuperAdmin, requireUser } from "../middleware/rbac";

export const controller = (prisma: PrismaClient) => {
	// Users can view their own profile, admins can view any
	const getById = requireUser(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;

		// Business logic: users can only view their own profile
		if (req.role === Role.user && id !== req.userId) {
			res.status(403).json({ error: "You can only view your own profile" });
			return;
		}

		// Your existing logic here...
	});

	// Only admins can list all users
	const getAll = requireAdmin(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		// Your existing logic here...
	});

	// Users can update own profile, admins can update any
	const update = requireUser(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { role, type, status, ...otherData } = req.body;

		// Business logic: regular users have restrictions
		if (req.role === Role.user) {
			if (id !== req.userId) {
				res.status(403).json({ error: "You can only update your own profile" });
				return;
			}

			if (role || type || status) {
				res.status(403).json({ error: "You cannot update role, type, or status" });
				return;
			}
		}

		// Your existing logic here...
	});

	// Only super admins can delete
	const remove = requireSuperAdmin(
		async (req: AuthRequest, res: Response, _next: NextFunction) => {
			// Your existing logic here...
		},
	);

	return {
		getById,
		getAll,
		update,
		remove,
	};
};
```

## Router Integration

**No changes needed in your routers!** The RBAC is handled at the controller level:

```typescript
// user.router.ts - works exactly the same
export const router = (route: Router, controller: IController): Router => {
	const routes = Router();
	const path = "/user";

	// Apply token verification (this stays the same)
	routes.use(verifyToken);

	// Routes work exactly as before - RBAC is in the controller
	routes.get("/:id", controller.getById); // Protected by requireUser
	routes.get("/", controller.getAll); // Protected by requireAdmin
	routes.patch("/:id", controller.update); // Protected by requireUser
	routes.put("/:id", controller.remove); // Protected by requireSuperAdmin

	route.use(path, routes);
	return route;
};
```

## Advanced Usage Patterns

### 1. Bulk Controller Protection

```typescript
export const controller = (prisma: PrismaClient) => {
	// Define methods normally
	const getById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		/* ... */
	};
	const getAll = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		/* ... */
	};
	const update = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		/* ... */
	};
	const remove = async (req: AuthRequest, res: Response, _next: NextFunction) => {
		/* ... */
	};

	// Apply protections in bulk
	return protectController(
		{
			getById,
			getAll,
			update,
			remove,
		},
		{
			getById: [Role.user, Role.admin, Role.super_admin],
			getAll: [Role.admin, Role.super_admin],
			update: [Role.user, Role.admin, Role.super_admin],
			remove: [Role.super_admin],
		},
	);
};
```

### 2. Complex Business Logic with RBAC

```typescript
const complexMethod = requireUser(async (req: AuthRequest, res: Response, _next: NextFunction) => {
	const { id } = req.params;

	try {
		// The user's role is available in req.role
		// The user's ID is available in req.userId

		// Implement your business logic with role-aware permissions
		if (req.role === Role.user) {
			// User-specific logic
		} else if (req.role === Role.admin) {
			// Admin-specific logic
		} else if (req.role === Role.super_admin) {
			// Super admin-specific logic
		}

		// Your database operations here...
	} catch (error) {
		res.status(500).json({ error: "Internal server error" });
	}
});
```

## Error Responses

The RBAC middleware provides consistent error responses:

### 401 Unauthorized

```json
{
	"message": "Authentication required"
}
```

### 403 Forbidden

```json
{
	"message": "Insufficient permissions",
	"required": ["admin", "super_admin"],
	"current": "user"
}
```

## Migration Guide

### From Global Middleware

If you're currently using global middleware in your routes, here's how to migrate:

**Before (in index.ts):**

```typescript
app.use(config.baseApiPath, verifyToken);
app.use(config.baseApiPath, verifyRole([Role.admin, Role.user, Role.super_admin]));
app.use(config.baseApiPath, user);
```

**After:**

```typescript
// Remove global verifyRole, keep only verifyToken
app.use(config.baseApiPath, verifyToken);
app.use(config.baseApiPath, user);
```

**In Controllers:**
Add the appropriate RBAC decorator to each method as shown above.

### Benefits of Migration

1. **Granular Control**: Different methods can have different permission levels
2. **Better Security**: Each endpoint is explicitly protected
3. **Clearer Code**: Permissions are visible at the method level
4. **Easier Testing**: Test permissions per method
5. **Type Safety**: TypeScript ensures correct usage

## Best Practices

1. **Always use `AuthRequest`** instead of `Request` in protected methods
2. **Combine RBAC with business logic** for fine-grained control
3. **Use convenience decorators** (`requireAdmin`, `requireUser`) when possible
4. **Document permissions** in your API documentation
5. **Test all permission levels** for each endpoint
6. **Keep business logic separate** from authorization logic

## Testing

```typescript
// Example test structure
describe("User Controller RBAC", () => {
	it("should allow admin to access getAll", async () => {
		const req = { role: Role.admin } as AuthRequest;
		// Test logic
	});

	it("should deny user access to getAll", async () => {
		const req = { role: Role.user } as AuthRequest;
		// Test logic - should return 403
	});
});
```

## Troubleshooting

### Common Issues

1. **"req.role is undefined"**

    - Ensure `verifyToken` middleware is applied before the protected route
    - Check that JWT token includes the role field

2. **"Cannot read property 'userId' of undefined"**

    - Update your JWT payload to include `userId`
    - Ensure the updated `verifyToken` middleware is being used

3. **TypeScript errors**
    - Use `AuthRequest` instead of `Request` for protected methods
    - Import types from the correct middleware files

### Debug Tips

Add logging to see what's happening:

```typescript
const debugMethod = requireUser(async (req: AuthRequest, res: Response, _next: NextFunction) => {
	console.log("User role:", req.role);
	console.log("User ID:", req.userId);
	// Your logic here
});
```
