namespace SecureAccess.Api.Entities;

public class AuditEvent
{
    public int Id { get; set; }

    public int? ActorEmployeeId { get; set; }

    public string Action { get; set; } = string.Empty;

    public string EntityType { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    public string? Details { get; set; }

    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;

    public Employee? ActorEmployee { get; set; }
}