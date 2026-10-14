using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using SecureAccess.Api.Data;
using SecureAccess.Api.Entities;
using SecureAccess.Api.Contracts;

var builder = WebApplication.CreateBuilder(args);


builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var entra = builder.Configuration.GetSection("Entra");

        options.Authority =
            $"{entra["Instance"]}{entra["TenantId"]}";

        options.Audience = entra["Audience"];

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("SecureAccessFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var connectionString =
    builder.Configuration.GetConnectionString("SecureAccess")
    ?? throw new InvalidOperationException(
        "Connection string 'SecureAccess' was not found.");

builder.Services.AddDbContext<SecureAccessDbContext>(options =>
    options.UseSqlServer(connectionString));

var app = builder.Build();

app.UseCors("SecureAccessFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new
{
    application = "SecureAccess",
    status = "Healthy",
    version = "1.0.0"
}));

app.MapGet("/api/me", (System.Security.Claims.ClaimsPrincipal user) =>
{
    var entra = builder.Configuration.GetSection("Entra");
    var expectedTenantId = entra["TenantId"];

    var tenantId =
        user.FindFirst("tid")?.Value ??
        user.FindFirst(
            "http://schemas.microsoft.com/identity/claims/tenantid"
        )?.Value;

    var objectId =
        user.FindFirst("oid")?.Value ??
        user.FindFirst(
            "http://schemas.microsoft.com/identity/claims/objectidentifier"
        )?.Value;

    if (string.IsNullOrWhiteSpace(tenantId) ||
        !string.Equals(
            tenantId,
            expectedTenantId,
            StringComparison.OrdinalIgnoreCase))
    {
        return Results.Forbid();
    }

    if (string.IsNullOrWhiteSpace(objectId))
    {
        return Results.Problem(
            "The authenticated token does not contain an Entra object ID.",
            statusCode: StatusCodes.Status401Unauthorized);
    }

    return Results.Ok(new
    {
        tenantId,
        objectId
    });
}).RequireAuthorization();

app.MapGet("/api/access-requests", async (
    SecureAccessDbContext db,
    CancellationToken cancellationToken) =>
{
    var requests = await db.AccessRequests
        .AsNoTracking()
        .OrderByDescending(r => r.RequestedAtUtc)
        .Select(r => new
        {
            id = r.Id,
            employee = r.Employee.FullName,
            application = r.Application.Name,
            role = r.RequestedRole,
            status = r.Status,
            requestedAtUtc = r.RequestedAtUtc,
            reviewedBy = r.ReviewedByEmployeeId == null
                ? null
                : db.Employees
                    .Where(e => e.Id == r.ReviewedByEmployeeId)
                    .Select(e => e.FullName)
                    .FirstOrDefault(),
            reviewedAtUtc = r.ReviewedAtUtc,
            reviewComments = r.ReviewComments
        })
        .ToListAsync(cancellationToken);

    return Results.Ok(requests);
}).RequireAuthorization();

app.MapGet("/api/access-requests/{id:int}/audit-events", async (
    int id,
    SecureAccessDbContext db,
    CancellationToken cancellationToken) =>
{
    var requestExists = await db.AccessRequests
        .AnyAsync(r => r.Id == id, cancellationToken);

    if (!requestExists)
    {
        return Results.NotFound(new
        {
            message = $"Access request {id} was not found."
        });
    }

    var events = await db.AuditEvents
        .AsNoTracking()
        .Where(e =>
            e.EntityType == nameof(AccessRequest) &&
            e.EntityId == id)
        .OrderBy(e => e.OccurredAtUtc)
        .Select(e => new
        {
            id = e.Id,
            actor = db.Employees
                .Where(employee => employee.Id == e.ActorEmployeeId)
                .Select(employee => employee.FullName)
                .FirstOrDefault() ?? "Unknown actor",
            action = e.Action,
            entityType = e.EntityType,
            entityId = e.EntityId,
            details = e.Details,
            occurredAtUtc = e.OccurredAtUtc
        })
        .ToListAsync(cancellationToken);

    return Results.Ok(events);
}).RequireAuthorization();

app.MapGet("/api/employees", async (
    SecureAccessDbContext db,
    CancellationToken cancellationToken) =>
{
    var employees = await db.Employees
        .AsNoTracking()
        .Where(e => e.IsActive)
        .OrderBy(e => e.FullName)
        .Select(e => new
        {
            id = e.Id,
            fullName = e.FullName,
            employeeNumber = e.EmployeeNumber,
            department = e.Department
        })
        .ToListAsync(cancellationToken);

    return Results.Ok(employees);
}).RequireAuthorization();

app.MapGet("/api/applications", async (
    SecureAccessDbContext db,
    CancellationToken cancellationToken) =>
{
    var applications = await db.Applications
        .AsNoTracking()
        .Where(a => a.IsActive)
        .OrderBy(a => a.Name)
        .Select(a => new
        {
            id = a.Id,
            name = a.Name,
            description = a.Description
        })
        .ToListAsync(cancellationToken);

    return Results.Ok(applications);
}).RequireAuthorization();

app.MapPost("/api/access-requests", async (
    CreateAccessRequestDto input,
    SecureAccessDbContext db,
    CancellationToken cancellationToken) =>
{
    // Validate the request.
    if (input.EmployeeId <= 0 ||
        input.ManagedApplicationId <= 0)
    {
        return Results.BadRequest(new
        {
            message = "A valid employee and application are required."
        });
    }

    if (string.IsNullOrWhiteSpace(input.RequestedRole) ||
        input.RequestedRole.Trim().Length > 100)
    {
        return Results.BadRequest(new
        {
            message = "RequestedRole is required and must be 100 characters or fewer."
        });
    }

    if (string.IsNullOrWhiteSpace(input.BusinessJustification) ||
        input.BusinessJustification.Trim().Length > 1000)
    {
        return Results.BadRequest(new
        {
            message = "BusinessJustification is required and must be 1000 characters or fewer."
        });
    }

    var employee = await db.Employees
        .SingleOrDefaultAsync(
            e => e.Id == input.EmployeeId && e.IsActive,
            cancellationToken);

    if (employee is null)
    {
        return Results.BadRequest(new
        {
            message = "The employee does not exist or is inactive."
        });
    }

    var application = await db.Applications
        .SingleOrDefaultAsync(
            a => a.Id == input.ManagedApplicationId && a.IsActive,
            cancellationToken);

    if (application is null)
    {
        return Results.BadRequest(new
        {
            message = "The application does not exist or is inactive."
        });
    }

    var now = DateTime.UtcNow;

    var request = new AccessRequest
    {
        EmployeeId = employee.Id,
        ManagedApplicationId = application.Id,
        RequestedRole = input.RequestedRole.Trim(),
        BusinessJustification = input.BusinessJustification.Trim(),
        Status = "Pending",
        RequestedAtUtc = now
    };

    await using var transaction =
        await db.Database.BeginTransactionAsync(cancellationToken);

    db.AccessRequests.Add(request);
    await db.SaveChangesAsync(cancellationToken);

    db.AuditEvents.Add(new AuditEvent
    {
        ActorEmployeeId = employee.Id,
        Action = "AccessRequestCreated",
        EntityType = nameof(AccessRequest),
        EntityId = request.Id,
        Details = $"Requested role '{request.RequestedRole}' " +
                  $"for application '{application.Name}'.",
        OccurredAtUtc = now
    });

    await db.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);

    return Results.Created(
        $"/api/access-requests/{request.Id}",
        new
        {
            id = request.Id,
            employee = employee.FullName,
            application = application.Name,
            role = request.RequestedRole,
            status = request.Status,
            requestedAtUtc = request.RequestedAtUtc
        });
}).RequireAuthorization();


app.MapPut("/api/access-requests/{id:int}/review", async (
    int id,
    ReviewAccessRequestDto input,
    System.Security.Claims.ClaimsPrincipal user,
    SecureAccessDbContext db,
    CancellationToken cancellationToken) =>
{
    var decision = input.Decision.Trim();

    if (!decision.Equals("Approved", StringComparison.OrdinalIgnoreCase) &&
        !decision.Equals("Rejected", StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new
        {
            message = "Decision must be Approved or Rejected."
        });
    }

    if (input.Comments?.Length > 1000)
    {
        return Results.BadRequest(new
        {
            message = "Comments must be 1000 characters or fewer."
        });
    }

    // Resolve identity from the validated Entra access token.
    var entra = builder.Configuration.GetSection("Entra");
    var expectedTenantId = entra["TenantId"];

    var tenantId =
        user.FindFirst("tid")?.Value ??
        user.FindFirst(
            "http://schemas.microsoft.com/identity/claims/tenantid"
        )?.Value;

    var objectId =
        user.FindFirst("oid")?.Value ??
        user.FindFirst(
            "http://schemas.microsoft.com/identity/claims/objectidentifier"
        )?.Value;

    if (string.IsNullOrWhiteSpace(tenantId) ||
        !string.Equals(
            tenantId,
            expectedTenantId,
            StringComparison.OrdinalIgnoreCase))
    {
        return Results.Forbid();
    }

    if (!Guid.TryParse(objectId, out var reviewerObjectId))
    {
        return Results.Unauthorized();
    }

    var reviewerObjectIdString = reviewerObjectId.ToString();

    var reviewer = await db.Employees
        .SingleOrDefaultAsync(
            e => e.EntraObjectId == reviewerObjectIdString && e.IsActive,
            cancellationToken);

    if (reviewer is null)
    {
        return Results.Problem(
            "Your signed-in account is not linked to an active SecureAccess employee.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    if (!reviewer.CanReviewAccessRequests)
    {
        return Results.Problem(
            "You are not authorized to review access requests.",
            statusCode: StatusCodes.Status403Forbidden);
    }

    var request = await db.AccessRequests
        .SingleOrDefaultAsync(
            r => r.Id == id,
            cancellationToken);

    if (request is null)
    {
        return Results.NotFound(new
        {
            message = $"Access request {id} was not found."
        });
    }

    if (request.Status != "Pending")
    {
        return Results.Conflict(new
        {
            message = "Only pending requests can be reviewed."
        });
    }

    // The reviewer is derived from the authenticated identity, not the request body.
    if (request.EmployeeId == reviewer.Id)
    {
        return Results.BadRequest(new
        {
            message = "Employees cannot approve or reject their own access requests."
        });
    }

    var now = DateTime.UtcNow;
    var normalizedDecision = decision.Equals(
        "Approved",
        StringComparison.OrdinalIgnoreCase)
            ? "Approved"
            : "Rejected";

    await using var transaction =
        await db.Database.BeginTransactionAsync(cancellationToken);

    request.Status = normalizedDecision;
    request.ReviewedAtUtc = now;
    request.ReviewedByEmployeeId = reviewer.Id;
    request.ReviewComments = input.Comments?.Trim();

    db.AuditEvents.Add(new AuditEvent
    {
        ActorEmployeeId = reviewer.Id,
        Action = $"AccessRequest{normalizedDecision}",
        EntityType = nameof(AccessRequest),
        EntityId = request.Id,
        Details = string.IsNullOrWhiteSpace(input.Comments)
            ? $"Request {request.Id} was {normalizedDecision.ToLowerInvariant()}."
            : $"Request {request.Id} was {normalizedDecision.ToLowerInvariant()}. " +
              $"Comments: {input.Comments.Trim()}",
        OccurredAtUtc = now
    });

    await db.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);

    return Results.Ok(new
    {
        id = request.Id,
        status = request.Status,
        reviewedBy = reviewer.FullName,
        reviewedAtUtc = request.ReviewedAtUtc,
        comments = request.ReviewComments
    });
}).RequireAuthorization();

app.Run();