using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BiteTrack.Api.Data.Migrations
{
    public partial class AddMealDescription : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Meals",
                type: "TEXT",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Meals");
        }
    }
}
