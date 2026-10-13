using Microsoft.EntityFrameworkCore;
using SecureAccess.Api.Entities;

namespace SecureAccess.Api.Data;

public class SecureAccessDbContext : DbContext
{
    public SecureAccessDbContext(
        DbContextOptions<SecureAccessDbContext> options)
        : base(options)
    {
    }

    public DbSet<Employee> Employees => Set<Employee>();

    public DbSet<ManagedApplication> Applications =>
        Set<ManagedApplication>();

    public DbSet<AccessRequest> AccessRequests =>
        Set<AccessRequest>();

    public DbSet<AuditEvent> AuditEvents =>
        Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.EmployeeNumber)
                .HasMaxLength(30)
                .IsRequired();

            entity.HasIndex(e => e.EmployeeNumber)
                .IsUnique();

            entity.Property(e => e.FullName)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(e => e.Email)
                .HasMaxLength(256)
                .IsRequired();

            entity.HasIndex(e => e.Email)
                .IsUnique();

            entity.Property(e => e.Department)
                .HasMaxLength(100)
                .IsRequired();
        });

        modelBuilder.Entity<ManagedApplication>(entity =>
        {
            entity.HasKey(a => a.Id);

            entity.Property(a => a.Name)
                .HasMaxLength(150)
                .IsRequired();

            entity.HasIndex(a => a.Name)
                .IsUnique();

            entity.Property(a => a.Description)
                .HasMaxLength(500);
        });

        modelBuilder.Entity<AccessRequest>(entity =>
        {
            entity.HasKey(r => r.Id);

            entity.Property(r => r.RequestedRole)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(r => r.BusinessJustification)
                .HasMaxLength(1000)
                .IsRequired();

            entity.Property(r => r.Status)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(r => r.ReviewComments)
                .HasMaxLength(1000);

            entity.HasOne(r => r.Employee)
                .WithMany()
                .HasForeignKey(r => r.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Application)
                .WithMany()
                .HasForeignKey(r => r.ManagedApplicationId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.ReviewedByEmployee)
                .WithMany()
                .HasForeignKey(r => r.ReviewedByEmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(r => new
            {
                r.EmployeeId,
                r.Status
            });

            entity.HasIndex(r => r.RequestedAtUtc);
        });

        modelBuilder.Entity<AuditEvent>(entity =>
        {
            entity.HasKey(a => a.Id);

            entity.Property(a => a.Action)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(a => a.EntityType)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(a => a.Details)
                .HasMaxLength(2000);

            entity.HasOne(a => a.ActorEmployee)
                .WithMany()
                .HasForeignKey(a => a.ActorEmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(a => a.OccurredAtUtc);
        });
    }
}
